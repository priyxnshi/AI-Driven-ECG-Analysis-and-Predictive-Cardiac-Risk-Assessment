import datetime
import json
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='doctor') # 'doctor', 'admin', 'patient'
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'role': self.role,
            'patientId': self.patient_id,
            'created_at': self.created_at.isoformat()
        }


class Patient(db.Model):
    __tablename__ = 'patients'
    
    id = db.Column(db.Integer, primary_key=True)
    reference_id = db.Column(db.String(50), unique=True, nullable=False, index=True) # e.g. PT-10492
    name = db.Column(db.String(100), nullable=False)
    age = db.Column(db.Integer, nullable=False)
    sex = db.Column(db.String(10), nullable=False) # 'Male', 'Female', 'Other'
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    records = db.relationship('ECGRecord', backref='patient', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'referenceId': self.reference_id,
            'name': self.name,
            'age': self.age,
            'sex': self.sex,
            'createdAt': self.created_at.isoformat()
        }


class ECGRecord(db.Model):
    __tablename__ = 'ecg_records'
    
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patients.id'), nullable=True)
    filename = db.Column(db.String(255), nullable=False)
    file_hash = db.Column(db.String(64), unique=True, nullable=False, index=True) # SHA-256 hash of content
    file_path = db.Column(db.String(512), nullable=False)
    category = db.Column(db.String(50), nullable=False) # 'digital-signal', 'document', 'visual-scan'
    status = db.Column(db.String(20), nullable=False, default='queued') # 'queued', 'processing', 'complete', 'failed'
    progress = db.Column(db.Integer, nullable=False, default=0)
    error_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    
    result = db.relationship('AnalysisResult', backref='record', uselist=False, lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'patientId': self.patient_id,
            'filename': self.filename,
            'category': self.category,
            'status': self.status,
            'progress': self.progress,
            'errorMessage': self.error_message,
            'createdAt': self.created_at.isoformat()
        }


class AnalysisResult(db.Model):
    __tablename__ = 'analysis_results'
    
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, db.ForeignKey('ecg_records.id'), unique=True, nullable=False, index=True)
    
    # Core Clinical Metrics
    heart_rate = db.Column(db.Float, nullable=False)
    rr_interval = db.Column(db.Float, nullable=False)
    pr_interval = db.Column(db.Float, nullable=False)
    qrs_duration = db.Column(db.Float, nullable=False)
    qt_interval = db.Column(db.Float, nullable=False)
    qtc_interval = db.Column(db.Float, nullable=False)
    hrv_score = db.Column(db.Float, nullable=True)
    st_status = db.Column(db.String(50), nullable=True)
    heart_rate_status = db.Column(db.String(100), nullable=True)
    
    # AI Interpretation / Severity
    overall_severity = db.Column(db.String(20), nullable=False) # 'normal', 'borderline', 'abnormal'
    severity_score = db.Column(db.Integer, nullable=False) # 0-100
    summary = db.Column(db.Text, nullable=False)
    
    # JSON-encoded fields for arrays/nested objects
    findings_json = db.Column(db.Text, nullable=False) # List of Finding objects
    waveform_json = db.Column(db.Text, nullable=False) # Waveform data (leads, samples, peaks)
    
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': f"analysis_{self.record_id}",
            'recordId': self.record_id,
            'timestamp': self.created_at.isoformat(),
            'overallSeverity': self.overall_severity,
            'severityScore': self.severity_score,
            'summary': self.summary,
            'heartRate': self.heart_rate,
            'rrInterval': self.rr_interval,
            'prInterval': self.pr_interval,
            'qrsDuration': self.qrs_duration,
            'qtInterval': self.qt_interval,
            'qtcInterval': self.qtc_interval,
            'hrv': self.hrv_score,
            'stStatus': self.st_status,
            'heartRateStatus': self.heart_rate_status,
            'findings': json.loads(self.findings_json),
            'waveform': json.loads(self.waveform_json)
        }


class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    ip_address = db.Column(db.String(50), nullable=True)
    username = db.Column(db.String(80), nullable=True)
    event_type = db.Column(db.String(50), nullable=False) # 'invalid_upload', 'failed_auth', 'successful_login', 'delete_ecg', 'api_access'
    description = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'ipAddress': self.ip_address,
            'username': self.username,
            'eventType': self.event_type,
            'description': self.description,
            'timestamp': self.timestamp.isoformat()
        }
