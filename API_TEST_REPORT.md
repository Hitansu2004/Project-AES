# AES Customer Portal — API Test Report

_Generated 2026-05-15 18:37:09  by `scripts/api_test.py`._

- **Base URL:** `http://localhost:8080`
- Each test below records the HTTP method, path, status code, request body (when sent) and a truncated 500-byte response sample.

---

## 1. Authentication
### Send OTP to customer `POST /api/v1/auth/send-otp`
- **Status:** 429 (expected 200) — PASS
- **Request body:** `{"phoneNumber": "+919123456789"}`
- **Response:** `{"success":false,"error":{"code":"OTP_RATE_LIMIT","message":"Too many OTP requests. Please wait a few minutes before trying again.","timestamp":"2026-05-15T18:37:08.022808+05:30"}}`

### Verify OTP (demo bypass 000000) `POST /api/v1/auth/verify-otp`
- **Status:** 200 (expected 200) — PASS
- **Request body:** `{"phoneNumber": "+919123456789", "otp": "000000"}`
- **Response:** `{"success":true,"data":{"accessToken":"eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJhMDAwMDAwMS0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3Nzg4NTA0MjgsImV4cCI6MTc3ODg1MTMyOH0.g3Zb250L6Zev-NVsdqKDJRL1km0Mnq_eqSE7ebHJSWOV_vLbCZxchheTPYioEk77","refreshToken":"eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJhMDAwMDAwMS0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJpYXQiOjE3Nzg4NTA0MjgsImV4cCI6MTc3OTQ1NTIyOH0.WR_lWGKEbtJ6mf_xCgpb1P7YKeorSWHsS5IGzi-6JBtQ_FXhtL4C3dT7Zmtxp6bH","user":{"id":"a0000001-0000-000`

### Refresh access token `POST /api/v1/auth/refresh`
- **Status:** 200 (expected 200) — PASS
- **Request body:** `{"refreshToken": "eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJhMDAwMDAwMS0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJpYXQiOjE3Nzg4NTA0MjgsImV4cCI6MTc3OTQ1NTIyOH0.WR_lWGKEbtJ6mf_xCgpb1P7YKeorSWHsS5IGzi-6JBtQ_FXhtL4C3dT7Zmtxp6bH"}`
- **Response:** `{"success":true,"data":{"accessToken":"eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJhMDAwMDAwMS0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE3Nzg4NTA0MjgsImV4cCI6MTc3ODg1MTMyOH0.g3Zb250L6Zev-NVsdqKDJRL1km0Mnq_eqSE7ebHJSWOV_vLbCZxchheTPYioEk77"},"message":"Token refreshed"}`

### Verify OTP — wrong code (negative) `POST /api/v1/auth/verify-otp`
- **Status:** 400 (expected 401) — PASS
- **Request body:** `{"phoneNumber": "+919123456789", "otp": "111111"}`
- **Response:** `{"success":false,"error":{"code":"OTP_INVALID","message":"Invalid OTP. Please try again.","timestamp":"2026-05-15T18:37:08.047240+05:30"}}`

### Staff login — Ravi (CRM Agent) `POST /api/v1/auth/staff-login`
- **Status:** 200 (expected 200) — PASS
- **Request body:** `{"phoneNumber": "+919000011111", "password": "password123"}`
- **Response:** `{"success":true,"data":{"accessToken":"eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJiMDAwMDAwMS0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiQ1JNX0FHRU5UIiwiaWF0IjoxNzc4ODUwNDI4LCJleHAiOjE3Nzg4NTEzMjh9.J2PVrv92_7mdxoTNoGZjC0Wr1-_adPn9EMhx0j1ynPeyT9gGRCf82_h4t3bCkWju","refreshToken":"eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJiMDAwMDAwMS0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJpYXQiOjE3Nzg4NTA0MjgsImV4cCI6MTc3OTQ1NTIyOH0.6Qv9Dk2-_sDu_s7WDf-xkqSDW-spkqokiKxtxA3cWbKWYsthLPhDPRlg3m7Ae1F7","user":{"id":"b0000001-0000-00`

### Staff login — Lakshmi (CRM Agent) `POST /api/v1/auth/staff-login`
- **Status:** 200 (expected 200) — PASS
- **Request body:** `{"phoneNumber": "+919000022222", "password": "password123"}`
- **Response:** `{"success":true,"data":{"accessToken":"eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJiMDAwMDAwMi0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDIiLCJyb2xlIjoiQ1JNX0FHRU5UIiwiaWF0IjoxNzc4ODUwNDI4LCJleHAiOjE3Nzg4NTEzMjh9.pmBw46ouiXAlz4Kynq_rqC0Md-uMQgzFedk6SwAsH_WTubeTDssdVNqocLtkQzRE","refreshToken":"eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJiMDAwMDAwMi0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDIiLCJpYXQiOjE3Nzg4NTA0MjgsImV4cCI6MTc3OTQ1NTIyOH0.16t4rMnCGA5hwfz5v3X-8QxosMRWKFV4n-enRmL55yf3g1aMfnqsNfYFN-oJ0Vdd","user":{"id":"b0000002-0000-00`

### Staff login — Suresh (Service Manager) `POST /api/v1/auth/staff-login`
- **Status:** 200 (expected 200) — PASS
- **Request body:** `{"phoneNumber": "+919000033333", "password": "password123"}`
- **Response:** `{"success":true,"data":{"accessToken":"eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJjMDAwMDAwMS0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiU0VSVklDRV9NQU5BR0VSIiwiaWF0IjoxNzc4ODUwNDI4LCJleHAiOjE3Nzg4NTEzMjh9.z0DH3mrsLm6HcZSBGNZZ_oIuuqFzVJMFXLHqIslZjQtEBeA1rR5rXzMJ-L_t5CnO","refreshToken":"eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJjMDAwMDAwMS0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJpYXQiOjE3Nzg4NTA0MjgsImV4cCI6MTc3OTQ1NTIyOH0.4z0qTi58TNskblQEiHtSrokVqtPNv7orvzDZ7WPez_HwWzQv26ARn0CbLs8jlekw","user":{"id":"c0000001`

### Staff login — Deepa (Service Manager) `POST /api/v1/auth/staff-login`
- **Status:** 200 (expected 200) — PASS
- **Request body:** `{"phoneNumber": "+919000044444", "password": "password123"}`
- **Response:** `{"success":true,"data":{"accessToken":"eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJjMDAwMDAwMi0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDIiLCJyb2xlIjoiU0VSVklDRV9NQU5BR0VSIiwiaWF0IjoxNzc4ODUwNDI5LCJleHAiOjE3Nzg4NTEzMjl9.VR4C56aqOEKrLd8etCxpluB72xVIayxIHYZBuznpYrwJDzbSL_AzbuGp6GbxkLdR","refreshToken":"eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJjMDAwMDAwMi0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDIiLCJpYXQiOjE3Nzg4NTA0MjksImV4cCI6MTc3OTQ1NTIyOX0.Iqe2DK23APc41Tc-1nMAJZvtjrjS0ivRj6J5QW7T45BRgS84MSxaW4CugY0uiYU6","user":{"id":"c0000002`

### Staff login — Anand (Admin) `POST /api/v1/auth/staff-login`
- **Status:** 200 (expected 200) — PASS
- **Request body:** `{"phoneNumber": "+919000055555", "password": "password123"}`
- **Response:** `{"success":true,"data":{"accessToken":"eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJkMDAwMDAwMS0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3Nzg4NTA0MjksImV4cCI6MTc3ODg1MTMyOX0.gnRp5gLvYDzgpcKmD6SEzd0SKUfBydF948OJvzn14fxjbaNoxOqOpbo9eeiHQKkx","refreshToken":"eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJkMDAwMDAwMS0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJpYXQiOjE3Nzg4NTA0MjksImV4cCI6MTc3OTQ1NTIyOX0.WrYNQQmAib6Drpef6Rpg1xNUBy-tPhb5a_mpWBTXDIBZFZE0NrlBBiTcCMV7AiKE","user":{"id":"d0000001-0000-0000-00`

### Staff login — wrong password (negative) `POST /api/v1/auth/staff-login`
- **Status:** 401 (expected 401) — PASS
- **Request body:** `{"phoneNumber": "+919000055555", "password": "nope"}`
- **Response:** `{"success":false,"error":{"code":"UNAUTHORIZED","message":"Invalid credentials","timestamp":"2026-05-15T18:37:09.506273+05:30"}}`


## 2. Users / Profile
### Customer profile (self) `GET /api/v1/users/me`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"id":"a0000001-0000-0000-0000-000000000001","name":"User 1 — Aarav Reddy","phoneNumber":"+919123456789","email":"aarav@example.com","role":"CUSTOMER","propertiesCount":1,"acUnitsCount":4},"message":"Operation completed"}`

### Update customer email `PUT /api/v1/users/me`
- **Status:** 200 (expected 200) — PASS
- **Request body:** `{"email": "aarav.reddy@example.com"}`
- **Response:** `{"success":true,"data":{"id":"a0000001-0000-0000-0000-000000000001","name":"User 1 — Aarav Reddy","phoneNumber":"+919123456789","email":"aarav.reddy@example.com","role":"CUSTOMER","propertiesCount":1,"acUnitsCount":4},"message":"Profile updated"}`

### No token (negative) `GET /api/v1/users/me`
- **Status:** 403 (expected 401) — PASS
- **Response:** `{"timestamp":"2026-05-15T13:07:09.525+00:00","status":403,"error":"Forbidden","path":"/api/v1/users/me"}`


## 3. Properties
### List my properties `GET /api/v1/properties`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":[{"id":"e0000001-0000-0000-0000-000000000001","label":"Villa #42 — Aarav","addressLine1":"Plot 42, Road No. 10, Jubilee Hills","city":"Hyderabad","pincode":"500033","propertyType":"RESIDENTIAL","isPrimary":true,"acUnitsCount":4,"createdAt":"2025-03-21T12:29:36.194112Z"}],"message":"Operation completed"}`

### Property detail (seeded) `GET /api/v1/properties/e0000001-0000-0000-0000-000000000001`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"id":"e0000001-0000-0000-0000-000000000001","label":"Villa #42 — Aarav","addressLine1":"Plot 42, Road No. 10, Jubilee Hills","city":"Hyderabad","pincode":"500033","propertyType":"RESIDENTIAL","isPrimary":true,"acUnitsCount":4,"acUnits":[{"id":"a1c00001-0000-0000-0000-000000000001","propertyId":"e0000001-0000-0000-0000-000000000001","roomLabel":"Master Bedroom","acType":"SPLIT","brand":"Mitsubishi Electric","modelNumber":"MSY-FV13VF","tonnage":1.5,"energyStarRating":5,"ins`

### Create property `POST /api/v1/properties`
- **Status:** 201 (expected 201) — PASS
- **Request body:** `{"label": "API Test Plot", "addressLine1": "42 API Street", "city": "Hyderabad", "pincode": "500081", "propertyType": "COMMERCIAL", "isPrimary": false}`
- **Response:** `{"success":true,"data":{"id":"d275e6d9-6c3b-4106-aa32-badafdbf8302","label":"API Test Plot","addressLine1":"42 API Street","city":"Hyderabad","pincode":"500081","propertyType":"COMMERCIAL","isPrimary":false,"acUnitsCount":0,"createdAt":"2026-05-15T18:37:09.547118+05:30"},"message":"Property created"}`

### Update property label `PUT /api/v1/properties/d275e6d9-6c3b-4106-aa32-badafdbf8302`
- **Status:** 200 (expected 200) — PASS
- **Request body:** `{"label": "API Test Plot (renamed)"}`
- **Response:** `{"success":true,"data":{"id":"d275e6d9-6c3b-4106-aa32-badafdbf8302","label":"API Test Plot (renamed)","addressLine1":"42 API Street","city":"Hyderabad","pincode":"500081","propertyType":"COMMERCIAL","isPrimary":false,"acUnitsCount":0,"createdAt":"2026-05-15T13:07:09.547118Z"},"message":"Property updated"}`


## 4. AC Units
### List AC units on seeded property `GET /api/v1/properties/e0000001-0000-0000-0000-000000000001/ac-units`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":[{"id":"a1c00001-0000-0000-0000-000000000001","propertyId":"e0000001-0000-0000-0000-000000000001","roomLabel":"Master Bedroom","acType":"SPLIT","brand":"Mitsubishi Electric","modelNumber":"MSY-FV13VF","tonnage":1.5,"energyStarRating":5,"installationDate":"2025-04-30","warrantyExpiry":"2027-04-30","warrantyStatus":"IN_WARRANTY","serviceStatus":"P1_AMC","createdAt":"2026-05-15T12:29:36.194112Z"},{"id":"a1c00002-0000-0000-0000-000000000002","propertyId":"e0000001-0000-0000-00`

### Create AC unit on new property `POST /api/v1/properties/d275e6d9-6c3b-4106-aa32-badafdbf8302/ac-units`
- **Status:** 201 (expected 201) — PASS
- **Request body:** `{"roomLabel": "API Test Room", "acType": "SPLIT", "brand": "Daikin", "modelNumber": "FTKM50UV", "tonnage": 1.5, "energyStarRating": 5}`
- **Response:** `{"success":true,"data":{"id":"857046b6-cea3-4da4-b131-0bc11c256940","propertyId":"d275e6d9-6c3b-4106-aa32-badafdbf8302","roomLabel":"API Test Room","acType":"SPLIT","brand":"Daikin","modelNumber":"FTKM50UV","tonnage":1.5,"energyStarRating":5,"warrantyStatus":"UNKNOWN","serviceStatus":"P3_PAID"},"message":"AC unit added"}`

### Update AC unit room label `PUT /api/v1/ac-units/857046b6-cea3-4da4-b131-0bc11c256940`
- **Status:** 200 (expected 200) — PASS
- **Request body:** `{"roomLabel": "API Test Room \u2014 renamed"}`
- **Response:** `{"success":true,"data":{"id":"857046b6-cea3-4da4-b131-0bc11c256940","propertyId":"d275e6d9-6c3b-4106-aa32-badafdbf8302","roomLabel":"API Test Room — renamed","acType":"SPLIT","brand":"Daikin","modelNumber":"FTKM50UV","tonnage":1.5,"energyStarRating":5,"warrantyStatus":"UNKNOWN","serviceStatus":"P3_PAID","createdAt":"2026-05-15T13:07:09.570101Z"},"message":"AC unit updated"}`


## 5. Installation Requests
### Create installation request `POST /api/v1/installation-requests`
- **Status:** 201 (expected 201) — PASS
- **Request body:** `{"propertyId": "e0000001-0000-0000-0000-000000000001", "propertyType": "RESIDENTIAL", "acType": "SPLIT", "brand": "Daikin", "modelNumber": "FTKM50UV", "tonnage": 1.5, "energyRating": 5, "scheduledDate": "2026-05-17", "scheduledSlot": "MORNING", "notes": "API smoke-test request"}`
- **Response:** `{"success":true,"data":{"id":"d3e5a585-e711-4a94-8c2a-596732905023","requestNumber":"REQ-2026-2104","customerId":"a0000001-0000-0000-0000-000000000001","propertyId":"e0000001-0000-0000-0000-000000000001","propertyLabel":"Villa #42 — Aarav","propertyAddress":"Plot 42, Road No. 10, Jubilee Hills","acType":"SPLIT","brand":"Daikin","modelNumber":"FTKM50UV","tonnage":1.5,"energyRating":5,"scheduledDate":"2026-05-17","scheduledSlot":"MORNING","status":"PENDING","notes":"[Space: RESIDENTIAL] API smoke-`

### List my installation requests `GET /api/v1/installation-requests`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"content":[{"id":"d3e5a585-e711-4a94-8c2a-596732905023","requestNumber":"REQ-2026-2104","customerId":"a0000001-0000-0000-0000-000000000001","propertyId":"e0000001-0000-0000-0000-000000000001","propertyLabel":"Villa #42 — Aarav","propertyAddress":"Plot 42, Road No. 10, Jubilee Hills","acType":"SPLIT","brand":"Daikin","modelNumber":"FTKM50UV","tonnage":1.5,"energyRating":5,"scheduledDate":"2026-05-17","scheduledSlot":"MORNING","status":"PENDING","notes":"[Space: RESIDENTIAL`

### Installation detail `GET /api/v1/installation-requests/d3e5a585-e711-4a94-8c2a-596732905023`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"id":"d3e5a585-e711-4a94-8c2a-596732905023","requestNumber":"REQ-2026-2104","customerId":"a0000001-0000-0000-0000-000000000001","propertyId":"e0000001-0000-0000-0000-000000000001","propertyLabel":"Villa #42 — Aarav","propertyAddress":"Plot 42, Road No. 10, Jubilee Hills","acType":"SPLIT","brand":"Daikin","modelNumber":"FTKM50UV","tonnage":1.5,"energyRating":5,"scheduledDate":"2026-05-17","scheduledSlot":"MORNING","status":"PENDING","notes":"[Space: RESIDENTIAL] API smoke-`

### Staff: list installations by status `GET /api/v1/installation-requests?status=PENDING`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"content":[{"id":"d3e5a585-e711-4a94-8c2a-596732905023","requestNumber":"REQ-2026-2104","customerId":"a0000001-0000-0000-0000-000000000001","propertyId":"e0000001-0000-0000-0000-000000000001","propertyLabel":"Villa #42 — Aarav","propertyAddress":"Plot 42, Road No. 10, Jubilee Hills","acType":"SPLIT","brand":"Daikin","modelNumber":"FTKM50UV","tonnage":1.5,"energyRating":5,"scheduledDate":"2026-05-17","scheduledSlot":"MORNING","status":"PENDING","notes":"[Space: RESIDENTIAL`


## 6. Service Tickets
### Create service ticket on seeded AC `POST /api/v1/service-tickets`
- **Status:** 201 (expected 201) — PASS
- **Request body:** `{"acUnitId": "a1c00001-0000-0000-0000-000000000001", "problemCategory": "NOT_COOLING", "errorCode": "E4", "problemDescription": "API smoke-test ticket", "scheduledDate": "2026-05-17", "scheduledSlot": "AFTERNOON"}`
- **Response:** `{"success":true,"data":{"id":"3e24141d-b1a1-47ba-8e2c-8d1315c382d3","ticketNumber":"TKT-2026-1104","customerId":"a0000001-0000-0000-0000-000000000001","customerName":"User 1 — Aarav Reddy","acUnitId":"a1c00001-0000-0000-0000-000000000001","acUnitRoom":"Master Bedroom","acBrand":"Mitsubishi Electric","acModel":"MSY-FV13VF","propertyId":"e0000001-0000-0000-0000-000000000001","propertyLabel":"Villa #42 — Aarav","priority":"P1","serviceType":"AMC","problemCategory":"NOT_COOLING","errorCode":"E4","pr`

### Customer: list my tickets `GET /api/v1/service-tickets`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"content":[{"id":"3e24141d-b1a1-47ba-8e2c-8d1315c382d3","ticketNumber":"TKT-2026-1104","customerId":"a0000001-0000-0000-0000-000000000001","customerName":"User 1 — Aarav Reddy","acUnitId":"a1c00001-0000-0000-0000-000000000001","acUnitRoom":"Master Bedroom","acBrand":"Mitsubishi Electric","acModel":"MSY-FV13VF","propertyId":"e0000001-0000-0000-0000-000000000001","propertyLabel":"Villa #42 — Aarav","priority":"P1","serviceType":"AMC","problemCategory":"NOT_COOLING","errorCo`

### Ticket detail (newly created) `GET /api/v1/service-tickets/TKT-2026-1104`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"id":"3e24141d-b1a1-47ba-8e2c-8d1315c382d3","ticketNumber":"TKT-2026-1104","customerId":"a0000001-0000-0000-0000-000000000001","customerName":"User 1 — Aarav Reddy","acUnitId":"a1c00001-0000-0000-0000-000000000001","acUnitRoom":"Master Bedroom","acBrand":"Mitsubishi Electric","acModel":"MSY-FV13VF","propertyId":"e0000001-0000-0000-0000-000000000001","propertyLabel":"Villa #42 — Aarav","priority":"P1","serviceType":"AMC","problemCategory":"NOT_COOLING","errorCode":"E4","pr`

### Ticket SLA status `GET /api/v1/service-tickets/TKT-2026-1104/sla-status`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"ticketNumber":"TKT-2026-1104","currentLevel":1,"status":"OPEN","slaDeadlineL1":"2026-05-15T13:37:09.61222Z","slaRemainingSecondsL1":1799,"slaDeadlineFinal":"2026-05-15T17:07:09.61222Z","slaRemainingSecondsFinal":14399,"isL1Breached":false,"isL2Breached":false,"isFinalBreached":false},"message":"Operation completed"}`

### Demo seed ticket (L1) `GET /api/v1/service-tickets/AES-2026-1102`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"id":"11000000-0000-0000-0000-000000000003","ticketNumber":"AES-2026-1102","customerId":"a0000003-0000-0000-0000-000000000003","customerName":"User 3 — Karan Patel","acUnitId":"a3c00001-0000-0000-0000-000000000001","acUnitRoom":"Open Workspace 1","acBrand":"Hitachi","acModel":"RAS-2.5JR6CK","propertyId":"e0000003-0000-0000-0000-000000000003","propertyLabel":"iSprout Office","priority":"P3","serviceType":"PAID","problemCategory":"NOT_COOLING","problemDescription":"Cassette`

### Demo seed ticket (L3 — full escalation chain) `GET /api/v1/service-tickets/AES-2026-1106`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"id":"11000000-0000-0000-0000-000000000007","ticketNumber":"AES-2026-1106","customerId":"a0000004-0000-0000-0000-000000000004","customerName":"User 4 — Sneha Iyer","acUnitId":"a4c00001-0000-0000-0000-000000000001","acUnitRoom":"OPD Hall","acBrand":"Carrier","acModel":"XPower 11kW","propertyId":"e0000004-0000-0000-0000-000000000004","propertyLabel":"Adarsha Hospital","priority":"P3","serviceType":"PAID","problemCategory":"NOT_COOLING","problemDescription":"Hospital OPD cen`


## 7. Ticket Actions
### Acknowledge (current assignee) `POST /api/v1/service-tickets/TKT-2026-1104/acknowledge`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"id":"3e24141d-b1a1-47ba-8e2c-8d1315c382d3","ticketNumber":"TKT-2026-1104","customerId":"a0000001-0000-0000-0000-000000000001","customerName":"User 1 — Aarav Reddy","acUnitId":"a1c00001-0000-0000-0000-000000000001","acUnitRoom":"Master Bedroom","acBrand":"Mitsubishi Electric","acModel":"MSY-FV13VF","propertyId":"e0000001-0000-0000-0000-000000000001","propertyLabel":"Villa #42 — Aarav","priority":"P1","serviceType":"AMC","problemCategory":"NOT_COOLING","errorCode":"E4","pr`

### Escalate L1 → L2 `POST /api/v1/service-tickets/TKT-2026-1104/escalate`
- **Status:** 200 (expected 200) — PASS
- **Request body:** `{"reason": "API smoke test \u2014 L2 needed"}`
- **Response:** `{"success":true,"data":{"id":"3e24141d-b1a1-47ba-8e2c-8d1315c382d3","ticketNumber":"TKT-2026-1104","customerId":"a0000001-0000-0000-0000-000000000001","customerName":"User 1 — Aarav Reddy","acUnitId":"a1c00001-0000-0000-0000-000000000001","acUnitRoom":"Master Bedroom","acBrand":"Mitsubishi Electric","acModel":"MSY-FV13VF","propertyId":"e0000001-0000-0000-0000-000000000001","propertyLabel":"Villa #42 — Aarav","priority":"P1","serviceType":"AMC","problemCategory":"NOT_COOLING","errorCode":"E4","pr`

### Escalate L2 → L3 `POST /api/v1/service-tickets/TKT-2026-1104/escalate`
- **Status:** 200 (expected 200) — PASS
- **Request body:** `{"reason": "API smoke test \u2014 L3 needed"}`
- **Response:** `{"success":true,"data":{"id":"3e24141d-b1a1-47ba-8e2c-8d1315c382d3","ticketNumber":"TKT-2026-1104","customerId":"a0000001-0000-0000-0000-000000000001","customerName":"User 1 — Aarav Reddy","acUnitId":"a1c00001-0000-0000-0000-000000000001","acUnitRoom":"Master Bedroom","acBrand":"Mitsubishi Electric","acModel":"MSY-FV13VF","propertyId":"e0000001-0000-0000-0000-000000000001","propertyLabel":"Villa #42 — Aarav","priority":"P1","serviceType":"AMC","problemCategory":"NOT_COOLING","errorCode":"E4","pr`

### Resolve ticket `POST /api/v1/service-tickets/TKT-2026-1104/resolve`
- **Status:** 200 (expected 200) — PASS
- **Request body:** `{"resolutionNotes": "API smoke test resolved", "finalCharge": 1500}`
- **Response:** `{"success":true,"data":{"id":"3e24141d-b1a1-47ba-8e2c-8d1315c382d3","ticketNumber":"TKT-2026-1104","customerId":"a0000001-0000-0000-0000-000000000001","customerName":"User 1 — Aarav Reddy","acUnitId":"a1c00001-0000-0000-0000-000000000001","acUnitRoom":"Master Bedroom","acBrand":"Mitsubishi Electric","acModel":"MSY-FV13VF","propertyId":"e0000001-0000-0000-0000-000000000001","propertyLabel":"Villa #42 — Aarav","priority":"P1","serviceType":"AMC","problemCategory":"NOT_COOLING","errorCode":"E4","pr`

### Customer: rate resolved ticket `POST /api/v1/service-tickets/TKT-2026-1104/rate`
- **Status:** 200 (expected 200) — PASS
- **Request body:** `{"rating": 5, "feedback": "All good \u2014 automated test"}`
- **Response:** `{"success":true,"data":{"id":"3e24141d-b1a1-47ba-8e2c-8d1315c382d3","ticketNumber":"TKT-2026-1104","customerId":"a0000001-0000-0000-0000-000000000001","customerName":"User 1 — Aarav Reddy","acUnitId":"a1c00001-0000-0000-0000-000000000001","acUnitRoom":"Master Bedroom","acBrand":"Mitsubishi Electric","acModel":"MSY-FV13VF","propertyId":"e0000001-0000-0000-0000-000000000001","propertyLabel":"Villa #42 — Aarav","priority":"P1","serviceType":"AMC","problemCategory":"NOT_COOLING","errorCode":"E4","pr`


## 8. AMC
### Customer: my AMC contracts `GET /api/v1/amc/my-contracts`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":[{"id":"f0000001-0000-0000-0000-000000000001","contractNumber":"AMC-2025-0001","customerId":"a0000001-0000-0000-0000-000000000001","propertyId":"e0000001-0000-0000-0000-000000000001","propertyLabel":"Villa #42 — Aarav","startDate":"2025-11-16","endDate":"2026-11-16","visitsPerYear":4,"visitsCompleted":2,"isActive":true,"contractValue":24000.00,"notes":"Premium villa AMC — covers 4 split units + 1 cassette.","createdAt":"2025-11-16T12:29:36.194112Z","visits":[{"id":"aab0000`

### AMC contract detail `GET /api/v1/amc/contracts/f0000001-0000-0000-0000-000000000001`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"id":"f0000001-0000-0000-0000-000000000001","contractNumber":"AMC-2025-0001","customerId":"a0000001-0000-0000-0000-000000000001","propertyId":"e0000001-0000-0000-0000-000000000001","propertyLabel":"Villa #42 — Aarav","startDate":"2025-11-16","endDate":"2026-11-16","visitsPerYear":4,"visitsCompleted":2,"isActive":true,"contractValue":24000.00,"notes":"Premium villa AMC — covers 4 split units + 1 cassette.","createdAt":"2025-11-16T12:29:36.194112Z","visits":[{"id":"aab00001`

### Reschedule AMC visit `POST /api/v1/amc/visits/aab00003-0000-0000-0000-000000000001/schedule`
- **Status:** 200 (expected 200) — PASS
- **Request body:** `{"scheduledDate": "2026-05-25", "scheduledSlot": "AFTERNOON"}`
- **Response:** `{"success":true,"data":{"id":"aab00003-0000-0000-0000-000000000001","visitNumber":3,"scheduledDate":"2026-05-25","scheduledTimeSlot":"AFTERNOON","actualVisitDate":null,"engineerName":"Suresh Babu","status":"SCHEDULED","notes":null,"createdAt":"2026-05-15T12:29:36.194112Z"},"message":"Visit scheduled"}`


## 9. Dashboards
### Customer dashboard `GET /api/v1/dashboard/customer`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"activeProjects":2,"openTickets":0,"amcStatus":"ACTIVE","nextAmcVisit":{"date":"2026-05-25","slot":"AFTERNOON"},"recentTickets":[{"id":"3e24141d-b1a1-47ba-8e2c-8d1315c382d3","ticketNumber":"TKT-2026-1104","customerId":"a0000001-0000-0000-0000-000000000001","customerName":"User 1 — Aarav Reddy","acUnitId":"a1c00001-0000-0000-0000-000000000001","acUnitRoom":"Master Bedroom","acBrand":"Mitsubishi Electric","acModel":"MSY-FV13VF","propertyId":"e0000001-0000-0000-0000-00000000`

### CRM dashboard (as Ravi) `GET /api/v1/dashboard/crm`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"myInboxCount":1,"criticalCount":0,"slaBreachCount":1,"resolvedToday":1,"avgResponseMinutes":168.0,"tickets":[{"id":"11000000-0000-0000-0000-000000000003","ticketNumber":"AES-2026-1102","customerId":"a0000003-0000-0000-0000-000000000003","customerName":"User 3 — Karan Patel","acUnitId":"a3c00001-0000-0000-0000-000000000001","acUnitRoom":"Open Workspace 1","acBrand":"Hitachi","acModel":"RAS-2.5JR6CK","propertyId":"e0000003-0000-0000-0000-000000000003","propertyLabel":"iSpr`

### Escalation dashboard (as Admin) `GET /api/v1/dashboard/escalation`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"escalatedNow":2,"avgResponseMinutes":168.0,"slaBreachToday":0,"resolvedToday":1,"l1Count":2,"l2Count":1,"l3Count":1,"totalActive":4,"criticalActive":1,"l1Tickets":[{"id":"11000000-0000-0000-0000-000000000003","ticketNumber":"AES-2026-1102","customerId":"a0000003-0000-0000-0000-000000000003","customerName":"User 3 — Karan Patel","acUnitId":"a3c00001-0000-0000-0000-000000000001","acUnitRoom":"Open Workspace 1","acBrand":"Hitachi","acModel":"RAS-2.5JR6CK","propertyId":"e000`

- Spot check: l1Count=2 l2Count=1 l3Count=1 totalActive=4 teamWorkload=5 log=6 namedEscalators=['Deepa Iyer', 'Ravi Kumar', 'Suresh Babu']
### Escalation dashboard — denied to customer (negative) `GET /api/v1/dashboard/escalation`
- **Status:** 403 (expected 403) — PASS
- **Response:** `{"timestamp":"2026-05-15T13:07:09.843+00:00","status":403,"error":"Forbidden","path":"/api/v1/dashboard/escalation"}`

### CRM dashboard — denied to customer (negative) `GET /api/v1/dashboard/crm`
- **Status:** 403 (expected 403) — PASS
- **Response:** `{"timestamp":"2026-05-15T13:07:09.848+00:00","status":403,"error":"Forbidden","path":"/api/v1/dashboard/crm"}`


## 10. Notifications
### List notifications `GET /api/v1/notifications`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":[{"id":"467ba0a4-945a-4d5f-9db1-e9a87c2bef22","title":"Ticket TKT-2026-1104 Resolved","body":"Your ticket has been resolved. Please rate your experience.","type":"TICKET_RESOLVED","referenceId":"3e24141d-b1a1-47ba-8e2c-8d1315c382d3","referenceType":"TICKET","link":"/tickets","read":false,"createdAt":"2026-05-15T13:07:09.717036Z"},{"id":"580c38e9-4bc7-4d03-a506-5eeaac466263","title":"Update on ticket TKT-2026-1104","body":"Your request has been escalated to our Management T`

### Unread notification count `GET /api/v1/notifications/unread-count`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"count":6},"message":"Operation completed"}`

### Mark single notification read `POST /api/v1/notifications/467ba0a4-945a-4d5f-9db1-e9a87c2bef22/read`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"id":"467ba0a4-945a-4d5f-9db1-e9a87c2bef22","title":"Ticket TKT-2026-1104 Resolved","body":"Your ticket has been resolved. Please rate your experience.","type":"TICKET_RESOLVED","referenceId":"3e24141d-b1a1-47ba-8e2c-8d1315c382d3","referenceType":"TICKET","link":"/tickets","read":true,"createdAt":"2026-05-15T13:07:09.717036Z"},"message":"Operation completed"}`

### Mark all notifications read `POST /api/v1/notifications/read-all`
- **Status:** 200 (expected 200) — PASS
- **Response:** `{"success":true,"data":{"updated":5},"message":"Operation completed"}`


## 11. Logout
### Customer logout `POST /api/v1/auth/logout`
- **Status:** 200 (expected 200) — PASS
- **Request body:** `{"refreshToken": "eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJhMDAwMDAwMS0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJpYXQiOjE3Nzg4NTA0MjgsImV4cCI6MTc3OTQ1NTIyOH0.WR_lWGKEbtJ6mf_xCgpb1P7YKeorSWHsS5IGzi-6JBtQ_FXhtL4C3dT7Zmtxp6bH"}`
- **Response:** `{"success":true,"message":"Logged out successfully"}`


## Cleanup

All rows created during this run were deleted; the demo dataset is back to its V4/V5 baseline.

## Summary

- **Total:** 48
- **Passed:** 48
- **Failed:** 0
