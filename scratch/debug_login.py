import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import traceback
from backend import app, db
from models import User, AuditLog
from backend import generate_token

with app.app_context():
    try:
        print("[DEBUG] Querying user 'doctor'...")
        user = User.query.filter_by(username='doctor').first()
        if not user:
            print("[DEBUG] User 'doctor' not found!")
        else:
            print("[DEBUG] User found. ID:", user.id, "Role:", user.role, "Patient ID:", user.patient_id)
            print("[DEBUG] Checking password 'doctorpassword'...")
            pw_ok = user.check_password('doctorpassword')
            print("[DEBUG] Password correct?", pw_ok)
            
            if pw_ok:
                print("[DEBUG] Generating token...")
                token = generate_token(user)
                print("[DEBUG] Token generated successfully! Type:", type(token))
                
                # Check decoding/string representation of token
                if isinstance(token, bytes):
                    token = token.decode('utf-8')
                print("[DEBUG] Token string:", token[:30] + "...")
                
                print("[DEBUG] Creating successful login AuditLog...")
                log = AuditLog(
                    ip_address='127.0.0.1',
                    username=user.username,
                    event_type='successful_login',
                    description="Logged in successfully (debug)"
                )
                db.session.add(log)
                db.session.commit()
                print("[DEBUG] AuditLog committed successfully!")
    except Exception as e:
        print("\n❌ EXCEPTION CAUGHT:")
        traceback.print_exc()
