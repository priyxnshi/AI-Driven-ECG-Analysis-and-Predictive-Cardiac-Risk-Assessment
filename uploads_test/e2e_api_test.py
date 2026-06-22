import os
import time
import requests

BASE_URL = "http://localhost:8000"
UPLOADS_TEST_DIR = r"c:\AI-Driven-ECG-Analysis-and-Predictive-Cardiac-Risk-Assessment\AI-Driven-ECG-Analysis-and-Predictive-Cardiac-Risk-Assessment\uploads_test"

# 1. Login
print("Logging in to ECGenius backend...")
login_resp = requests.post(f"{BASE_URL}/api/auth/login", json={
    "username": "doctor",
    "password": "doctorpassword"
})
if login_resp.status_code != 200:
    print(f"Login failed: {login_resp.status_code} - {login_resp.text}")
    exit(1)

token = login_resp.json().get("token")
print("Login successful! Token acquired.")

headers = {
    "Authorization": f"Bearer {token}"
}

# 2. Upload valid ECG
filename = "valid_ecg.csv"
file_path = os.path.join(UPLOADS_TEST_DIR, filename)
print(f"\n--- Uploading '{filename}' ---")

with open(file_path, "rb") as f:
    data = {
        "patientReferenceId": "PT-DEFAULT"
    }
    resp = requests.post(
        f"{BASE_URL}/api/ecg/upload",
        headers=headers,
        files={"file": (filename, f, "text/csv")},
        data=data
    )

print(f"Upload Status Code: {resp.status_code}")
resp_json = resp.json()
print(f"Upload Response: {resp_json}")

record_id = None
if resp.status_code == 201:
    record_id = resp_json["record"]["id"]
elif resp.status_code == 200 and resp_json.get("duplicate"):
    record_id = resp_json["record"]["id"]
    print(f"Using existing duplicate record ID: {record_id}")
else:
    print("Failed to upload/link record!")
    exit(1)

# 3. Trigger analysis for this record
print(f"\n--- Triggering analysis for record ID {record_id} ---")
trigger_resp = requests.post(
    f"{BASE_URL}/api/ecg/analyze/batch",
    headers=headers,
    json={"recordIds": [record_id]}
)
print(f"Trigger Status Code: {trigger_resp.status_code}")
print(f"Trigger Response: {trigger_resp.json()}")

# 4. Poll status
print(f"\n--- Polling status of record ID {record_id} ---")
max_retries = 30
status = "queued"
for i in range(max_retries):
    status_resp = requests.get(
        f"{BASE_URL}/api/ecg/status/{record_id}",
        headers=headers
    )
    if status_resp.status_code == 200:
        rec = status_resp.json()
        status = rec["status"]
        progress = rec["progress"]
        print(f"Attempt {i+1}: Status = {status}, Progress = {progress}%")
        if status in ["complete", "failed"]:
            break
    else:
        print(f"Failed to check status: {status_resp.status_code}")
    time.sleep(1)

if status == "complete":
    print("\nSUCCESS: Analysis completed successfully!")
    
    # 5. Fetch results
    results_resp = requests.get(
        f"{BASE_URL}/api/ecg/results/{record_id}",
        headers=headers
    )
    print(f"Results Status Code: {results_resp.status_code}")
    results = results_resp.json()
    print("Results summary:")
    print(f"  - Heart Rate: {results.get('heartRate')} bpm")
    print(f"  - HRV Score: {results.get('hrv')} ms")
    print(f"  - Severity: {results.get('overallSeverity')}")
    print(f"  - Severity Score: {results.get('severityScore')}")
    print(f"  - Summary: {results.get('summary')}")
    print(f"  - Findings: {len(results.get('findings', []))} clinical conditions detected")
    
    # 6. Download report
    print(f"\n--- Downloading PDF Report for record ID {record_id} ---")
    report_resp = requests.get(
        f"{BASE_URL}/api/ecg/report/pdf/{record_id}",
        headers=headers
    )
    print(f"Report Status Code: {report_resp.status_code}")
    if report_resp.status_code == 200:
        pdf_content = report_resp.content
        if pdf_content.startswith(b"%PDF-"):
            print("SUCCESS: Valid PDF content received (starts with %PDF-).")
            pdf_path = os.path.join(UPLOADS_TEST_DIR, f"report_{record_id}.pdf")
            with open(pdf_path, "wb") as pdf_file:
                pdf_file.write(pdf_content)
            print(f"Report saved to: {pdf_path}")
        else:
            print("FAILED: Response does not start with PDF signature.")
    else:
        print(f"FAILED to download PDF: {report_resp.text}")
        
else:
    print(f"\nFAILED: Analysis did not complete. Final status = {status}")
