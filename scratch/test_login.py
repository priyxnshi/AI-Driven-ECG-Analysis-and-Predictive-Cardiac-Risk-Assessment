import requests
try:
    r = requests.post('http://localhost:8000/api/auth/login', json={'username': 'doctor', 'password': 'doctorpassword'})
    print("Status code:", r.status_code)
    print("Response text:", r.text[:1000])
except Exception as e:
    print("Error:", e)
