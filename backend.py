import os
import json
import datetime
import hashlib
import io
import csv
from functools import wraps
from flask import Flask, request, jsonify, send_file, make_response
from flask_cors import CORS
from flask_migrate import Migrate
import jwt
from models import db, User, Patient, ECGRecord, AnalysisResult, AuditLog
from validator import validate_ecg_file, log_validation_failure
from queue_manager import QueueManager, generate_pdf_report

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', 'ecgenius-super-secure-secret-key-clinical-10294')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///ecgenius.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize DB and Migrate
db.init_app(app)
migrate = Migrate(app, db)

# Ensure folders exist
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize Job Queue
queue_manager = QueueManager(app)

# ========== JWT HELPERS ==========

def generate_token(user):
    payload = {
        'sub': user.id,
        'username': user.username,
        'role': user.role,
        'patientId': user.patient_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
                
        if not token:
            return jsonify({'error': 'Authentication token required'}), 401
            
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            request.user = payload
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token is invalid'}), 401
            
        return f(*args, **kwargs)
    return decorated

def role_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not hasattr(request, 'user'):
                return jsonify({'error': 'Unauthorized'}), 401
            if request.user.get('role') not in allowed_roles:
                return jsonify({'error': 'Forbidden: Insufficient privileges'}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

def get_client_ip():
    return request.environ.get('HTTP_X_FORWARDED_FOR', request.remote_addr)

# ========== SEED DATABASE & STARTUP ==========

with app.app_context():
    db.create_all()
    # Check and seed default users
    if not User.query.filter_by(username='admin').first():
        admin = User(username='admin', role='admin')
        admin.set_password('adminpassword')
        db.session.add(admin)
        
    if not User.query.filter_by(username='doctor').first():
        doctor = User(username='doctor', role='doctor')
        doctor.set_password('doctorpassword')
        db.session.add(doctor)
        
    # Check and seed default patient
    if not Patient.query.filter_by(reference_id='PT-DEFAULT').first():
        patient = Patient(reference_id='PT-DEFAULT', name='Standard Clinical Demo', age=45, sex='Male')
        db.session.add(patient)
        
    db.session.commit()

# ========== API ENDPOINTS ==========

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'service': 'ECG Analysis Platform',
        'database': 'connected',
        'queue': 'running'
    })

# --- AUTHENTICATION ---

@app.route('/api/auth/register', methods=['POST'])
@token_required
@role_required(['admin'])
def register():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Missing username or password'}), 400
        
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
        
    user = User(
        username=data['username'],
        role=data.get('role', 'doctor')
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    
    # Log audit event
    log = AuditLog(
        ip_address=get_client_ip(),
        username=request.user['username'],
        event_type='register_user',
        description=f"Registered user '{user.username}' with role '{user.role}'"
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({'message': 'User registered successfully', 'user': user.to_dict()}), 201

def check_record_access(rec, user):
    if user.get('role') == 'patient':
        return rec.patient_id == user.get('patientId')
    return True

@app.route('/api/auth/register/patient', methods=['POST'])
def register_patient():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data or 'name' not in data:
        return jsonify({'error': 'Missing username, password or patient name'}), 400
        
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
        
    import random
    ref_id = f"PT-{random.randint(100000, 999999)}"
    while Patient.query.filter_by(reference_id=ref_id).first():
        ref_id = f"PT-{random.randint(100000, 999999)}"
        
    patient = Patient(
        reference_id=ref_id,
        name=data['name'],
        age=int(data.get('age', 40)),
        sex=data.get('sex', 'Other')
    )
    db.session.add(patient)
    db.session.commit()
    
    user = User(
        username=data['username'],
        role='patient',
        patient_id=patient.id
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    
    log = AuditLog(
        ip_address=get_client_ip(),
        username=user.username,
        event_type='register_patient',
        description=f"Registered patient user '{user.username}' linked to reference ID '{ref_id}'"
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({
        'message': 'Patient registered successfully',
        'user': user.to_dict(),
        'patient': patient.to_dict()
    }), 201

@app.route('/api/auth/register/doctor', methods=['POST'])
def register_doctor():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Missing username or password'}), 400
        
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 400
        
    user = User(
        username=data['username'],
        role='doctor'
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    
    log = AuditLog(
        ip_address=get_client_ip(),
        username=user.username,
        event_type='register_doctor',
        description=f"Registered doctor user '{user.username}'"
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({
        'message': 'Doctor registered successfully',
        'user': user.to_dict()
    }), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or 'username' not in data or 'password' not in data:
        return jsonify({'error': 'Missing username or password'}), 400
        
    user = User.query.filter_by(username=data['username']).first()
    if not user or not user.check_password(data['password']):
        # Log auth failure
        log = AuditLog(
            ip_address=get_client_ip(),
            username=data['username'],
            event_type='failed_auth',
            description="Failed login attempt"
        )
        db.session.add(log)
        db.session.commit()
        return jsonify({'error': 'Invalid credentials'}), 401
        
    token = generate_token(user)
    
    # Log successful login
    log = AuditLog(
        ip_address=get_client_ip(),
        username=user.username,
        event_type='successful_login',
        description="Logged in successfully"
    )
    db.session.add(log)
    db.session.commit()
    
    return jsonify({
        'token': token,
        'user': user.to_dict()
    }), 200

# --- PATIENTS ---

@app.route('/api/patients', methods=['GET'])
@token_required
@role_required(['doctor', 'admin'])
def get_patients():
    patients = Patient.query.all()
    return jsonify([p.to_dict() for p in patients]), 200

@app.route('/api/patients', methods=['POST'])
@token_required
@role_required(['doctor', 'admin'])
def create_patient():
    data = request.get_json()
    if not data or 'name' not in data or 'referenceId' not in data:
        return jsonify({'error': 'Missing patient name or reference ID'}), 400
        
    if Patient.query.filter_by(reference_id=data['referenceId']).first():
        return jsonify({'error': 'Patient reference ID already exists'}), 400
        
    p = Patient(
        reference_id=data['referenceId'],
        name=data['name'],
        age=int(data.get('age', 40)),
        sex=data.get('sex', 'Other')
    )
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201

@app.route('/api/patients/<patient_id>/timeline', methods=['GET'])
@token_required
def get_patient_timeline(patient_id):
    p = Patient.query.filter((Patient.reference_id == patient_id) | (Patient.id == patient_id)).first()
    if not p:
        return jsonify({'error': 'Patient not found'}), 404
        
    if request.user.get('role') == 'patient':
        if p.id != request.user.get('patientId'):
            return jsonify({'error': 'Forbidden: Access to this timeline is denied.'}), 403
        
    records = ECGRecord.query.filter_by(patient_id=p.id).order_by(ECGRecord.created_at.desc()).all()
    timeline = []
    for r in records:
        res = r.result
        timeline.append({
            'recordId': r.id,
            'filename': r.filename,
            'date': r.created_at.isoformat(),
            'status': r.status,
            'severity': res.overall_severity if res else 'unknown',
            'heartRate': res.heart_rate if res else None,
            'summary': res.summary if res else None
        })
    return jsonify({
        'patient': p.to_dict(),
        'timeline': timeline
    }), 200

# --- ECG OPERATIONS (UPLOAD, BATCH QUEUE) ---

@app.route('/api/ecg/upload', methods=['POST'])
@token_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    # Save to a temporary location to calculate hash and validate
    temp_path = os.path.join(UPLOAD_FOLDER, f"temp_{file.filename}")
    file.save(temp_path)

    # 1. Perform strict file validation
    try:
        category = validate_ecg_file(temp_path, file.filename, get_client_ip(), request.user['username'])
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({'error': str(e)}), 400

    # 2. Check for duplicate content hash
    sha256 = hashlib.sha256()
    with open(temp_path, 'rb') as f:
        while chunk := f.read(8192):
            sha256.update(chunk)
    file_hash = sha256.hexdigest()

    existing_rec = ECGRecord.query.filter_by(file_hash=file_hash).first()
    if existing_rec:
        os.remove(temp_path)
        return jsonify({
            'message': 'Duplicate ECG file detected. Already processed.',
            'record': existing_rec.to_dict(),
            'duplicate': True
        }), 200

    # 3. Save permanently and create record
    ext = file.filename.lower().split('.')[-1] if '.' in file.filename else ''
    record_id = f"rec_{len(ECGRecord.query.all())}_{int(datetime.datetime.utcnow().timestamp())}"
    final_path = os.path.join(UPLOAD_FOLDER, f"{record_id}.{ext}")
    os.replace(temp_path, final_path)

    # Resolve patient linkage
    if request.user.get('role') == 'patient':
        patient = Patient.query.get(request.user.get('patientId'))
    else:
        patient_ref = request.form.get('patientReferenceId', 'PT-DEFAULT')
        patient = Patient.query.filter_by(reference_id=patient_ref).first()
        if not patient and patient_ref != 'PT-DEFAULT':
            patient = Patient(
                reference_id=patient_ref,
                name=request.form.get('patientName', 'Uploaded Patient'),
                age=int(request.form.get('patientAge', 45)),
                sex=request.form.get('patientSex', 'Other')
            )
            db.session.add(patient)
            db.session.commit()

    record = ECGRecord(
        patient_id=patient.id if patient else None,
        filename=file.filename,
        file_hash=file_hash,
        file_path=final_path,
        category=category,
        status='queued',
        progress=0
    )
    db.session.add(record)
    db.session.commit()

    # Log successful upload audit event
    log = AuditLog(
        ip_address=get_client_ip(),
        username=request.user['username'],
        event_type='upload_ecg',
        description=f"Uploaded ECG file '{file.filename}' successfully."
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({
        'record': record.to_dict(),
        'message': 'ECG successfully uploaded and queued for processing.'
    }), 201

@app.route('/api/ecg/analyze/batch', methods=['POST'])
@token_required
def trigger_batch_analysis():
    data = request.get_json()
    if not data or 'recordIds' not in data:
        return jsonify({'error': 'Missing record IDs for batch analysis'}), 400
        
    ids = data['recordIds']
    triggered = []
    
    for r_id in ids:
        rec = ECGRecord.query.get(r_id)
        if rec and rec.status in ['queued', 'failed']:
            rec.status = 'queued'
            rec.progress = 0
            rec.error_message = None
            db.session.commit()
            
            # Send to queue manager
            queue_manager.add_job(rec.id)
            triggered.append(rec.id)
            
    return jsonify({
        'message': f"Triggered analysis for {len(triggered)} records.",
        'triggeredRecordIds': triggered
    }), 200

@app.route('/api/ecg/status/<record_id>', methods=['GET'])
@token_required
def get_status(record_id):
    rec = ECGRecord.query.get(record_id)
    if not rec:
        return jsonify({'error': 'Record not found'}), 404
    if not check_record_access(rec, request.user):
        return jsonify({'error': 'Forbidden: Access to this record is denied.'}), 403
    return jsonify(rec.to_dict()), 200

@app.route('/api/ecg/results/<record_id>', methods=['GET'])
@token_required
def get_results(record_id):
    rec = ECGRecord.query.get(record_id)
    if not rec:
        return jsonify({'error': 'Record not found'}), 404
    if not check_record_access(rec, request.user):
        return jsonify({'error': 'Forbidden: Access to this record is denied.'}), 403
        
    res = rec.result
    if not res:
        return jsonify({'error': 'Analysis result is not ready or failed.'}), 400
        
    patient = Patient.query.get(rec.patient_id)
    
    response_data = res.to_dict()
    if patient:
        response_data['patient'] = patient.to_dict()
        
    return jsonify(response_data), 200

@app.route('/api/ecg/results/compare', methods=['POST'])
@token_required
def compare_results():
    data = request.get_json()
    if not data or 'recordIds' not in data:
        return jsonify({'error': 'Missing record IDs to compare'}), 400
        
    ids = data['recordIds']
    comparisons = []
    
    for r_id in ids:
        rec = ECGRecord.query.get(r_id)
        if rec and rec.result:
            res = rec.result
            patient = Patient.query.get(rec.patient_id)
            item = res.to_dict()
            if patient:
                item['patient'] = patient.to_dict()
            comparisons.append(item)
            
    return jsonify(comparisons), 200

@app.route('/api/ecg/delete', methods=['POST'])
@token_required
def delete_records():
    data = request.get_json()
    if not data or 'recordIds' not in data:
        return jsonify({'error': 'Missing record IDs for deletion'}), 400
        
    ids = data['recordIds']
    deleted = []
    
    for r_id in ids:
        rec = ECGRecord.query.get(r_id)
        if rec:
            filename = rec.filename
            if os.path.exists(rec.file_path):
                os.remove(rec.file_path)
            
            db.session.delete(rec)
            deleted.append(r_id)
            
            # Log deletion
            log = AuditLog(
                ip_address=get_client_ip(),
                username=request.user['username'],
                event_type='delete_ecg',
                description=f"Deleted record {r_id} ({filename})"
            )
            db.session.add(log)
            
    db.session.commit()
    return jsonify({'message': f"Deleted {len(deleted)} records", 'deletedRecordIds': deleted}), 200

# --- CLINICAL REPORTS GENERATION ---

@app.route('/api/ecg/report/pdf/<record_id>', methods=['GET'])
@token_required
def get_pdf_report(record_id):
    rec = ECGRecord.query.get(record_id)
    if not rec or not rec.result:
        return jsonify({'error': 'Record results not available'}), 404
        
    if not check_record_access(rec, request.user):
        return jsonify({'error': 'Forbidden: Access to this report is denied.'}), 403
        
    patient = Patient.query.get(rec.patient_id)
    pdf_data = generate_pdf_report(rec.result, patient)
    
    return send_file(
        io.BytesIO(pdf_data),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f"Report_{patient.reference_id}_{record_id}.pdf"
    )

@app.route('/api/ecg/report/batch/pdf', methods=['POST'])
@token_required
def get_batch_pdf_report():
    data = request.get_json()
    if not data or 'recordIds' not in data:
        return jsonify({'error': 'Missing record IDs'}), 400
        
    ids = data['recordIds']
    
    # We generate a consolidated document containing reports of all records
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle', parent=styles['Heading1'], fontSize=20, leading=24, textColor=colors.HexColor('#2563eb'), spaceAfter=15
    )
    section_style = ParagraphStyle(
        'SectionHeading', parent=styles['Heading2'], fontSize=12, leading=16, textColor=colors.HexColor('#1f2937'), spaceBefore=10, spaceAfter=6
    )
    body_style = styles['Normal']
    
    added = 0
    for r_id in ids:
        rec = ECGRecord.query.get(r_id)
        if not rec or not rec.result:
            continue
            
        patient = Patient.query.get(rec.patient_id)
        result = rec.result
        
        if added > 0:
            story.append(PageBreak())
            
        story.append(Paragraph(f"Batch ECG Report - Page {added+1}", ParagraphStyle('Sub', parent=body_style, textColor=colors.HexColor('#6b7280'), spaceAfter=10)))
        story.append(Paragraph("ECGenius Clinical Analysis Report", title_style))
        story.append(Spacer(1, 10))
        
        # Patient Info Table
        patient_data = [
            [Paragraph("<b>Patient Name:</b>", body_style), Paragraph(patient.name, body_style), 
             Paragraph("<b>Patient ID:</b>", body_style), Paragraph(patient.reference_id, body_style)],
            [Paragraph("<b>Age / Sex:</b>", body_style), Paragraph(f"{patient.age} / {patient.sex}", body_style), 
             Paragraph("<b>Date:</b>", body_style), Paragraph(result.created_at.strftime("%Y-%m-%d %H:%M"), body_style)]
        ]
        t = Table(patient_data, colWidths=[100, 160, 100, 160])
        t.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('PADDING', (0,0), (-1,-1), 6),
            ('BACKGROUND', (0,0), (0,-1), colors.whitesmoke),
            ('BACKGROUND', (2,0), (2,-1), colors.whitesmoke),
        ]))
        story.append(t)
        story.append(Spacer(1, 15))
        
        # Assessment Summary
        story.append(Paragraph("Overall Assessment", section_style))
        sev_color = '#10b981' if result.overall_severity == 'normal' else '#f59e0b' if result.overall_severity == 'borderline' else '#ef4444'
        story.append(Paragraph(f"<b>Severity:</b> <font color='{sev_color}'>{result.overall_severity.upper()}</font> (Score: {result.severity_score}/100)", body_style))
        story.append(Paragraph(f"<b>Summary:</b> {result.summary}", body_style))
        story.append(Spacer(1, 15))
        
        # Metrics Table
        story.append(Paragraph("Waveform Measurements", section_style))
        metrics_data = [
            ["Heart Rate", f"{result.heart_rate} BPM", "QRS Duration", f"{result.qrs_duration} ms"],
            ["R-R Interval", f"{result.rr_interval} ms", "PR Interval", f"{result.pr_interval} ms"],
            ["QTc Interval", f"{result.qtc_interval} ms", "HRV (SDNN)", f"{result.hrv_score or '--'} ms"],
            ["ST Status", f"{result.st_status or 'Normal'}", "Heart Rate Status", f"{result.heart_rate_status or 'Normal'}"]
        ]
        t_metrics = Table(metrics_data, colWidths=[130, 130, 130, 130])
        t_metrics.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('PADDING', (0,0), (-1,-1), 5),
            ('BACKGROUND', (0,0), (0,-1), colors.whitesmoke),
            ('BACKGROUND', (2,0), (2,-1), colors.whitesmoke),
        ]))
        story.append(t_metrics)
        story.append(Spacer(1, 15))
        
        # Findings
        story.append(Paragraph("Detailed Findings", section_style))
        findings = json.loads(result.findings_json)
        for idx, f in enumerate(findings):
            f_sev_color = '#10b981' if f['severity'] == 'normal' else '#f59e0b' if f['severity'] == 'borderline' else '#ef4444'
            story.append(Paragraph(f"<b>{idx+1}. {f['clinicalTerm']}</b> — <font color='{f_sev_color}'>{f['severity'].upper()}</font> (Confidence: {f['confidence']}%)", body_style))
            story.append(Paragraph(f"<i>Details:</i> {f.get('details', '') or f['plainLanguage']}", body_style))
            story.append(Spacer(1, 6))
            
        added += 1
        
    if added == 0:
        return jsonify({'error': 'No matching complete reports found'}), 400
        
    doc.build(story)
    buffer.seek(0)
    
    return send_file(
        io.BytesIO(buffer.getvalue()),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f"Batch_Report_{int(datetime.datetime.utcnow().timestamp())}.pdf"
    )

@app.route('/api/ecg/report/csv/<record_id>', methods=['GET'])
@token_required
def get_csv_report(record_id):
    rec = ECGRecord.query.get(record_id)
    if not rec or not rec.result:
        return jsonify({'error': 'Record results not available'}), 404
        
    if not check_record_access(rec, request.user):
        return jsonify({'error': 'Forbidden: Access to this report is denied.'}), 403
        
    res = rec.result
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers and details
    writer.writerow(["ECG Analysis Export Report"])
    writer.writerow(["Record ID", rec.id])
    writer.writerow(["Date Generated", res.created_at.isoformat()])
    writer.writerow(["Heart Rate (BPM)", res.heart_rate])
    writer.writerow(["Average RR Interval (ms)", res.rr_interval])
    writer.writerow(["PR Interval (ms)", res.pr_interval])
    writer.writerow(["QRS Duration (ms)", res.qrs_duration])
    writer.writerow(["QTc Interval (ms)", res.qtc_interval])
    writer.writerow(["HRV Score (SDNN)", res.hrv_score])
    writer.writerow(["ST Segment Status", res.st_status])
    writer.writerow(["Severity Level", res.overall_severity])
    writer.writerow(["Severity Score", res.severity_score])
    writer.writerow(["Clinical Summary", res.summary])
    
    response = make_response(output.getvalue())
    response.headers["Content-Disposition"] = f"attachment; filename=Report_{rec.id}.csv"
    response.headers["Content-type"] = "text/csv"
    return response

@app.route('/api/ecg/report/json/<record_id>', methods=['GET'])
@token_required
def get_json_report(record_id):
    rec = ECGRecord.query.get(record_id)
    if not rec or not rec.result:
        return jsonify({'error': 'Record results not available'}), 404
        
    if not check_record_access(rec, request.user):
        return jsonify({'error': 'Forbidden: Access to this report is denied.'}), 403
        
    return jsonify(rec.result.to_dict()), 200

@app.route('/api/ecg/records', methods=['GET'])
@token_required
def get_all_records():
    if request.user.get('role') == 'patient':
        patient_id = request.user.get('patientId')
        records = ECGRecord.query.filter_by(patient_id=patient_id).order_by(ECGRecord.created_at.desc()).all()
    else:
        records = ECGRecord.query.order_by(ECGRecord.created_at.desc()).all()
    results = []
    for r in records:
        patient = Patient.query.get(r.patient_id)
        res = r.result
        results.append({
            'id': r.id,
            'filename': r.filename,
            'createdAt': r.created_at.isoformat(),
            'status': r.status,
            'category': r.category,
            'severity': res.overall_severity if res else 'unknown',
            'patientName': patient.name if patient else 'Unknown',
            'patientRef': patient.reference_id if patient else 'N/A'
        })
    return jsonify(results), 200

# --- DOCTOR PORTAL & SECURITY STATS ---

@app.route('/api/dashboard/stats', methods=['GET'])
@token_required
@role_required(['doctor', 'admin'])
def get_dashboard_stats():
    total_ecgs = ECGRecord.query.count()
    pending = ECGRecord.query.filter_by(status='queued').count() + ECGRecord.query.filter_by(status='processing').count()
    completed = ECGRecord.query.filter_by(status='complete').count()
    
    # Critical cases (severity = abnormal)
    critical = db.session.query(ECGRecord).join(AnalysisResult).filter(AnalysisResult.overall_severity == 'abnormal').count()
    
    # Recent Uploads
    recent_records = ECGRecord.query.order_by(ECGRecord.created_at.desc()).limit(5).all()
    recent = []
    for r in recent_records:
        patient = Patient.query.get(r.patient_id)
        recent.append({
            'id': r.id,
            'filename': r.filename,
            'status': r.status,
            'createdAt': r.created_at.isoformat(),
            'patientName': patient.name if patient else 'Unknown'
        })
        
    return jsonify({
        'totalECGs': total_ecgs,
        'pendingAnalyses': pending,
        'completedAnalyses': completed,
        'criticalCases': critical,
        'recentUploads': recent
    }), 200

@app.route('/api/dashboard/audit', methods=['GET'])
@token_required
@role_required(['admin'])
def get_audit_logs():
    logs = AuditLog.query.order_by(AuditLog.timestamp.desc()).limit(100).all()
    return jsonify([l.to_dict() for l in logs]), 200

# --- PTB-XL DATASET EVALUATION ENDPOINTS ---

@app.route('/api/ptbxl/metrics', methods=['GET'])
@token_required
@role_required(['doctor', 'admin'])
def get_ptbxl_metrics():
    metrics_path = os.path.join('outputs', 'ptbxl_metrics.json')
    if os.path.exists(metrics_path):
        with open(metrics_path, 'r') as f:
            try:
                metrics = json.load(f)
                return jsonify(metrics), 200
            except Exception as e:
                return jsonify({'error': f"Failed to parse metrics: {str(e)}"}), 500
    else:
        # Default structured empty metrics response
        return jsonify({
            'overallAccuracy': None,
            'totalTestRecords': 0,
            'perClassMetrics': {},
            'confusionMatrix': []
        }), 200

@app.route('/api/ptbxl/evaluate', methods=['POST'])
@token_required
@role_required(['doctor', 'admin'])
def evaluate_ptbxl():
    import subprocess
    import sys
    
    # Log the action in audit logs
    log = AuditLog(
        ip_address=get_client_ip(),
        username=request.user['username'],
        event_type='evaluate_ptbxl',
        description="Triggered PTB-XL model fine-tuning and evaluation"
    )
    db.session.add(log)
    db.session.commit()
    
    try:
        # Get current python interpreter path
        python_bin = sys.executable
        print(f"[API] Running PTB-XL fine-tuning script via {python_bin} train_ptb_xl.py...")
        res = subprocess.run([python_bin, 'train_ptb_xl.py'], capture_output=True, text=True, check=True)
        
        # Read the newly generated metrics
        metrics_path = os.path.join('outputs', 'ptbxl_metrics.json')
        if os.path.exists(metrics_path):
            with open(metrics_path, 'r') as f:
                metrics = json.load(f)
            return jsonify(metrics), 200
        else:
            return jsonify({'error': 'Evaluation completed but metrics file was not found.'}), 500
    except subprocess.CalledProcessError as e:
        print("PTB-XL Evaluation failed:", e.stderr)
        return jsonify({'error': f"Evaluation failed: {e.stderr}"}), 500


@app.route('/api/ptbxl/confusion-matrix', methods=['GET'])
def get_ptbxl_confusion_matrix():
    cm_path = os.path.join(os.getcwd(), 'outputs', 'ptbxl_confusion_matrix.png')
    if os.path.exists(cm_path):
        return send_file(cm_path, mimetype='image/png')
    else:
        return jsonify({'error': 'Confusion matrix image not found.'}), 404

if __name__ == '__main__':
    print("ECG Analysis Platform Backend Starting...")
    print("API Base: http://localhost:8000")
    print("=" * 60)
    app.run(debug=False, host='0.0.0.0', port=8000)

