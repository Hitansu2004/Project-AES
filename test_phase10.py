import subprocess
import json
import urllib.request
import urllib.error

PHONE = "+919876543210"
BASE_URL = "http://localhost:8080/api/v1"

def make_request(url, method="GET", data=None, headers={}):
    req = urllib.request.Request(url, method=method)
    for k, v in headers.items():
        req.add_header(k, v)
    if data:
        req.add_header("Content-Type", "application/json")
        data_bytes = json.dumps(data).encode("utf-8")
    else:
        data_bytes = None
        
    try:
        with urllib.request.urlopen(req, data=data_bytes) as response:
            res_data = response.read().decode("utf-8")
            if res_data:
                return json.loads(res_data)
            return {}
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code} - {e.read().decode('utf-8')}")
        exit(1)
    except Exception as e:
        print(f"Error: {e}")
        exit(1)

print("1. Sending OTP...")
make_request(f"{BASE_URL}/auth/send-otp", method="POST", data={"phoneNumber": PHONE})

print("2. Fetching OTP from DB...")
cmd = f"psql -U aes_user -d aes_db -t -c \"SELECT otp_code FROM otp_tokens WHERE phone_number='{PHONE}' ORDER BY created_at DESC LIMIT 1;\""
otp = subprocess.check_output(cmd, shell=True).decode('utf-8').strip()
print(f"OTP found: {otp}")

print("3. Verifying OTP...")
res = make_request(f"{BASE_URL}/auth/verify-otp", method="POST", data={"phoneNumber": PHONE, "otp": otp})
token = res['data']['accessToken']
headers = {"Authorization": f"Bearer {token}"}

print("4. Fetching Properties...")
props_res = make_request(f"{BASE_URL}/properties", headers=headers)
props = props_res.get('data', [])
if not props:
    print("No properties found")
    exit(1)
prop_id = props[0]['id']

print(f"5. Fetching AC Units for property {prop_id}...")
units_res = make_request(f"{BASE_URL}/properties/{prop_id}/ac-units", headers=headers)
units = units_res.get('data', [])
if not units:
    print("No AC units found")
    exit(1)
ac_unit_id = units[0]['id']

print("6. Creating Service Ticket...")
payload = {
    "propertyId": prop_id,
    "acUnitId": ac_unit_id,
    "priority": "P2",
    "serviceType": "REPAIR",
    "problemCategory": "NOT_COOLING",
    "errorCode": "E4",
    "problemDescription": "Testing phase 10 via python script",
    "scheduledDate": "2026-10-25",
    "scheduledSlot": "14:00-16:00"
}
ticket_res = make_request(f"{BASE_URL}/service-tickets", method="POST", data=payload, headers=headers)
ticket_num = ticket_res['data']['ticketNumber']
print(f"Created Ticket: {ticket_num}")

print("7. Fetching Ticket Details...")
details_res = make_request(f"{BASE_URL}/service-tickets/{ticket_num}", headers=headers)
print("SUCCESS: Fetched ticket details!")
print(json.dumps(details_res['data'], indent=2))
