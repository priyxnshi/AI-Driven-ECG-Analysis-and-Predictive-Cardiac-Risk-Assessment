import os
import json
import io
import unittest
from backend import app, db
from models import User, Patient, ECGRecord, AnalysisResult

class ECGPlatformTestCase(unittest.TestCase):
    
    def setUp(self):
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.client = app.test_client()
        
        with app.app_context():
            db.create_all()
            
            # Seed test users if not exists
            self.admin = User.query.filter_by(username='test_admin').first()
            if not self.admin:
                self.admin = User(username='test_admin', role='admin')
                self.admin.set_password('adminpass')
                db.session.add(self.admin)
                
            self.doctor = User.query.filter_by(username='test_doctor').first()
            if not self.doctor:
                self.doctor = User(username='test_doctor', role='doctor')
                self.doctor.set_password('docpass')
                db.session.add(self.doctor)
            
            # Seed default patient if not exists
            self.patient = Patient.query.filter_by(reference_id='PT-DEFAULT').first()
            if not self.patient:
                self.patient = Patient(reference_id='PT-DEFAULT', name='Standard Clinical Demo', age=45, sex='Male')
                db.session.add(self.patient)
                
            db.session.commit()
            
        # Obtain auth tokens
        self.admin_token = self._get_token('test_admin', 'adminpass')
        self.doctor_token = self._get_token('test_doctor', 'docpass')

    def tearDown(self):
        with app.app_context():
            db.session.remove()
            db.drop_all()

    def _get_token(self, username, password):
        response = self.client.post('/api/auth/login', json={
            'username': username,
            'password': password
        })
        data = json.loads(response.data)
        return data.get('token')

    # ========== AUTHENTICATION TESTS ==========
    
    def test_login_success(self):
        response = self.client.post('/api/auth/login', json={
            'username': 'test_doctor',
            'password': 'docpass'
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('token', data)
        self.assertEqual(data['user']['role'], 'doctor')

    def test_login_invalid_credentials(self):
        response = self.client.post('/api/auth/login', json={
            'username': 'test_doctor',
            'password': 'wrongpassword'
        })
        self.assertEqual(response.status_code, 401)

    def test_endpoint_auth_protection(self):
        # Access patient list without token
        response = self.client.get('/api/patients')
        self.assertEqual(response.status_code, 401)

    def test_role_based_access_control(self):
        # Admin-only audit logs route requested by doctor
        response = self.client.get('/api/dashboard/audit', headers={
            'Authorization': f'Bearer {self.doctor_token}'
        })
        self.assertEqual(response.status_code, 403)
        
        # requested by admin
        response = self.client.get('/api/dashboard/audit', headers={
            'Authorization': f'Bearer {self.admin_token}'
        })
        self.assertEqual(response.status_code, 200)

    # ========== ECG INGESTION VALIDATION TESTS ==========

    def test_upload_valid_csv(self):
        csv_content = b"sample,MLII,V5\n1,0.1,0.2\n2,-0.1,-0.2\n3,0.12,0.25\n"
        response = self.client.post('/api/ecg/upload', 
            headers={'Authorization': f'Bearer {self.doctor_token}'},
            data={
                'file': (io.BytesIO(csv_content), 'valid_ecg.csv'),
                'patientReferenceId': 'PT-DEFAULT'
            }
        )
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertIn('record', data)
        self.assertEqual(data['record']['status'], 'queued')

    def test_upload_duplicate_detection(self):
        csv_content = b"sample,MLII,V5\n1,0.1,0.2\n2,-0.1,-0.2\n3,0.12,0.25\n"
        
        # First upload
        resp1 = self.client.post('/api/ecg/upload', 
            headers={'Authorization': f'Bearer {self.doctor_token}'},
            data={
                'file': (io.BytesIO(csv_content), 'ecg_record1.csv'),
                'patientReferenceId': 'PT-DEFAULT'
            }
        )
        self.assertEqual(resp1.status_code, 201)
        
        # Duplicate upload
        resp2 = self.client.post('/api/ecg/upload', 
            headers={'Authorization': f'Bearer {self.doctor_token}'},
            data={
                'file': (io.BytesIO(csv_content), 'ecg_record1.csv'),
                'patientReferenceId': 'PT-DEFAULT'
            }
        )
        self.assertEqual(resp2.status_code, 200)
        data = json.loads(resp2.data)
        self.assertTrue(data.get('duplicate'))

    def test_reject_renamed_non_ecg_file(self):
        # Renamed PDF content disguised as a CSV file
        fake_csv_pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog ... >>"
        response = self.client.post('/api/ecg/upload', 
            headers={'Authorization': f'Bearer {self.doctor_token}'},
            data={
                'file': (io.BytesIO(fake_csv_pdf), 'fake_ecg.csv')
            }
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertIn('signature indicates PDF', data['error'])

    def test_reject_executable_binary(self):
        exe_content = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"
        response = self.client.post('/api/ecg/upload', 
            headers={'Authorization': f'Bearer {self.doctor_token}'},
            data={
                'file': (io.BytesIO(exe_content), 'run_malware.exe')
            }
        )
        self.assertEqual(response.status_code, 400)

    def test_reject_arbitrary_text(self):
        random_text = b"This is a random text file and has no headers or rows of ECG signal metrics."
        response = self.client.post('/api/ecg/upload', 
            headers={'Authorization': f'Bearer {self.doctor_token}'},
            data={
                'file': (io.BytesIO(random_text), 'random.csv')
            }
        )
        self.assertEqual(response.status_code, 400)

    # ========== DOCTOR PORTAL STATS TESTS ==========

    def test_get_dashboard_stats(self):
        response = self.client.get('/api/dashboard/stats', headers={
            'Authorization': f'Bearer {self.doctor_token}'
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('totalECGs', data)
        self.assertIn('pendingAnalyses', data)
        self.assertIn('completedAnalyses', data)
        self.assertIn('criticalCases', data)
        self.assertIn('recentUploads', data)

    # ========== ROLE-BASED ACCESS & REGISTRATION TESTS ==========

    def test_patient_registration_and_login(self):
        # Register a patient
        response = self.client.post('/api/auth/register/patient', json={
            'username': 'pat_test',
            'password': 'patpass123',
            'name': 'John Doe',
            'age': 30,
            'sex': 'Male'
        })
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertIn('patient', data)
        self.assertIn('user', data)
        self.assertEqual(data['user']['role'], 'patient')
        self.assertIsNotNone(data['user']['patientId'])
        
        # Log in as the patient
        login_resp = self.client.post('/api/auth/login', json={
            'username': 'pat_test',
            'password': 'patpass123'
        })
        self.assertEqual(login_resp.status_code, 200)
        login_data = json.loads(login_resp.data)
        self.assertIn('token', login_data)
        self.assertEqual(login_data['user']['role'], 'patient')
        self.assertEqual(login_data['user']['patientId'], data['user']['patientId'])

    def test_doctor_registration_and_login(self):
        # Register a doctor
        response = self.client.post('/api/auth/register/doctor', json={
            'username': 'doc_test',
            'password': 'docpass123'
        })
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertEqual(data['user']['role'], 'doctor')
        
        # Log in as the doctor
        login_resp = self.client.post('/api/auth/login', json={
            'username': 'doc_test',
            'password': 'docpass123'
        })
        self.assertEqual(login_resp.status_code, 200)
        login_data = json.loads(login_resp.data)
        self.assertIn('token', login_data)
        self.assertEqual(login_data['user']['role'], 'doctor')

    def test_patient_rbac_restrictions(self):
        # 1. Register and log in as Patient A
        resp_a = self.client.post('/api/auth/register/patient', json={
            'username': 'patient_a',
            'password': 'password_a',
            'name': 'Patient A',
            'age': 25,
            'sex': 'Female'
        })
        self.assertEqual(resp_a.status_code, 201)
        token_a = self._get_token('patient_a', 'password_a')

        # 2. Register and log in as Patient B
        resp_b = self.client.post('/api/auth/register/patient', json={
            'username': 'patient_b',
            'password': 'password_b',
            'name': 'Patient B',
            'age': 60,
            'sex': 'Male'
        })
        self.assertEqual(resp_b.status_code, 201)
        token_b = self._get_token('patient_b', 'password_b')

        # 3. Patient A uploads an ECG file
        csv_content = b"sample,MLII,V5\n1,0.1,0.2\n2,-0.1,-0.2\n3,0.12,0.25\n"
        upload_resp = self.client.post('/api/ecg/upload', 
            headers={'Authorization': f'Bearer {token_a}'},
            data={
                'file': (io.BytesIO(csv_content), 'pat_a_ecg.csv')
            }
        )
        self.assertEqual(upload_resp.status_code, 201)
        upload_data = json.loads(upload_resp.data)
        record_id = upload_data['record']['id']

        # 4. Patient A requests their records list -> should see 1 record
        records_a_resp = self.client.get('/api/ecg/records', headers={'Authorization': f'Bearer {token_a}'})
        self.assertEqual(records_a_resp.status_code, 200)
        records_a = json.loads(records_a_resp.data)
        self.assertEqual(len(records_a), 1)
        self.assertEqual(records_a[0]['id'], record_id)

        # 5. Patient B requests their records list -> should see 0 records
        records_b_resp = self.client.get('/api/ecg/records', headers={'Authorization': f'Bearer {token_b}'})
        self.assertEqual(records_b_resp.status_code, 200)
        records_b = json.loads(records_b_resp.data)
        self.assertEqual(len(records_b), 0)

        # 6. Patient B attempts to fetch Patient A's record status -> should return 403 Forbidden
        status_b_resp = self.client.get(f'/api/ecg/status/{record_id}', headers={'Authorization': f'Bearer {token_b}'})
        self.assertEqual(status_b_resp.status_code, 403)

        # 7. Patient B attempts to access dashboard stats -> should return 403 Forbidden
        stats_b_resp = self.client.get('/api/dashboard/stats', headers={'Authorization': f'Bearer {token_b}'})
        self.assertEqual(stats_b_resp.status_code, 403)


if __name__ == '__main__':
    unittest.main()
