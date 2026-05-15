#!/usr/bin/env python3
"""
AES Customer Portal — End-to-end API smoke test.

Hits every backend HTTP endpoint (auth, profile, properties, AC units,
installation requests, service tickets, ticket actions, AMC, dashboards,
notifications), then cleans up every row it created so the demo dataset
returns to its V4/V5 baseline.

    Usage:
        python3 scripts/api_test.py
        API_BASE=http://localhost:8080 python3 scripts/api_test.py

    Output:
        - human-readable progress on stdout
        - full report at  ./API_TEST_REPORT.md

Requires:
        - Backend running on $API_BASE  (default http://localhost:8080)
        - psql client + Postgres reachable on  $PG_HOST:5432  with
          credentials $PG_USER / $PG_PASS / $PG_DB  (used purely for
          post-run cleanup of rows the test created)
"""
from __future__ import annotations

import datetime as dt
import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
API_BASE = os.environ.get("API_BASE", "http://localhost:8080").rstrip("/")
REPORT_PATH = os.environ.get("REPORT", "API_TEST_REPORT.md")
PG = {
    "host": os.environ.get("PG_HOST", "localhost"),
    "user": os.environ.get("PG_USER", "aes_user"),
    "pass": os.environ.get("PG_PASS", "aes_pass"),
    "db":   os.environ.get("PG_DB",   "aes_db"),
}

DEMO_OTP = "000000"
STAFF_PASSWORD = "password123"

CUST_PHONE  = "+919123456789"     # User 1 — Aarav Reddy
CRM_PHONE   = "+919000011111"     # Ravi  (CRM Agent)
CRM2_PHONE  = "+919000022222"     # Lakshmi (CRM Agent)
SVC_PHONE   = "+919000033333"     # Suresh (Service Manager)
SVC2_PHONE  = "+919000044444"     # Deepa  (Service Manager)
ADMIN_PHONE = "+919000055555"     # Anand  (Admin)

# ANSI helpers (kept simple — fall back to plain text if not a TTY)
USE_COLOR = sys.stdout.isatty()
GRN = "\033[32m" if USE_COLOR else ""
RED = "\033[31m" if USE_COLOR else ""
YLW = "\033[33m" if USE_COLOR else ""
DIM = "\033[2m"  if USE_COLOR else ""
END = "\033[0m"  if USE_COLOR else ""


# ---------------------------------------------------------------------------
# State / counters
# ---------------------------------------------------------------------------
@dataclass
class Counters:
    passed: int = 0
    failed: int = 0
    failures: list[str] = field(default_factory=list)


CTR = Counters()
REPORT_BUF: list[str] = []
CREATED_PROPERTY_IDS:  list[str] = []
CREATED_AC_UNIT_IDS:   list[str] = []
CREATED_TICKET_IDS:    list[str] = []
CREATED_INSTALL_IDS:   list[str] = []
USER_ID:               str  = ""


def banner(title: str) -> None:
    print(f"\n──────────────  {title}  ──────────────")
    REPORT_BUF.append(f"\n## {title}\n")


# ---------------------------------------------------------------------------
# HTTP layer — stdlib only.  Returns (status_code, parsed_or_raw_body, raw_body)
# ---------------------------------------------------------------------------
def request(method: str, path: str, *, body: dict | None = None,
            token: str | None = None) -> tuple[int, Any, str]:
    url = API_BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, method=method, headers=headers, data=data)
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read().decode("utf-8", errors="replace")
            status = r.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace") if e.fp else ""
        status = e.code
    except urllib.error.URLError as e:
        raw = f"<urlerror: {e.reason}>"
        status = 0
    try:
        parsed = json.loads(raw) if raw else None
    except json.JSONDecodeError:
        parsed = None
    return status, parsed, raw


def expect(want_status: int, method: str, path: str, name: str,
           *, body: dict | None = None, token: str | None = None,
           also_accept: tuple[int, ...] = ()) -> tuple[int, Any]:
    status, parsed, raw = request(method, path, body=body, token=token)
    accept = (want_status,) + tuple(also_accept)
    ok = status in accept
    sample = raw[:500].replace("\n", " ")

    tag = f"{GRN}✓ PASS{END}" if ok else f"{RED}✗ FAIL{END}"
    print(f"  {tag}  {method:<4}  {path:<55} -> {status}"
          + (f"  (expected {want_status})" if not ok else ""))

    REPORT_BUF.append(f"### {name} `{method} {path}`\n")
    REPORT_BUF.append(f"- **Status:** {status} (expected {want_status})"
                      f" — {'PASS' if ok else '**FAIL**'}\n")
    if body is not None:
        REPORT_BUF.append(f"- **Request body:** `{json.dumps(body)}`\n")
    REPORT_BUF.append(f"- **Response:** `{sample}`\n\n")

    if ok:
        CTR.passed += 1
    else:
        CTR.failed += 1
        CTR.failures.append(f"{method} {path} → {status} (expected {want_status})")
    return status, parsed


def data(parsed: Any, *path: str, default=None):
    """Walk a {success, data, message} envelope safely."""
    cur = parsed
    if cur is None:
        return default
    if isinstance(cur, dict) and "data" in cur and not path:
        return cur["data"]
    for p in path:
        if isinstance(cur, dict):
            cur = cur.get(p)
        elif isinstance(cur, list) and p.isdigit():
            i = int(p)
            cur = cur[i] if 0 <= i < len(cur) else None
        else:
            return default
        if cur is None:
            return default
    return cur


# ---------------------------------------------------------------------------
# Test runs
# ---------------------------------------------------------------------------
def run_tests() -> None:
    today = dt.date.today()
    plus2 = (today + dt.timedelta(days=2)).isoformat()
    plus10 = (today + dt.timedelta(days=10)).isoformat()

    # 1. Auth ----------------------------------------------------------------
    banner("1. Authentication")
    # Rate-limit (3/10min) returns 429 if this script has been re-run rapidly
    # — that's the limiter doing its job, so we accept it as a valid response.
    expect(200, "POST", "/api/v1/auth/send-otp",
           "Send OTP to customer", body={"phoneNumber": CUST_PHONE},
           also_accept=(429,))
    _, p = expect(200, "POST", "/api/v1/auth/verify-otp",
                  "Verify OTP (demo bypass 000000)",
                  body={"phoneNumber": CUST_PHONE, "otp": DEMO_OTP})
    cust_token   = data(p, "data", "accessToken")
    cust_refresh = data(p, "data", "refreshToken")
    global USER_ID
    USER_ID      = data(p, "data", "user", "id") or ""
    print(f"  {DIM}→ token captured for customer {USER_ID[:8]}…{END}")

    expect(200, "POST", "/api/v1/auth/refresh", "Refresh access token",
           body={"refreshToken": cust_refresh})

    expect(401, "POST", "/api/v1/auth/verify-otp",
           "Verify OTP — wrong code (negative)",
           body={"phoneNumber": CUST_PHONE, "otp": "111111"},
           also_accept=(400,))   # backend may return either depending on which guard fires first

    # Staff login round-trip for every role ---------------------------------
    staff_logins = [
        (CRM_PHONE,   "Ravi (CRM Agent)"),
        (CRM2_PHONE,  "Lakshmi (CRM Agent)"),
        (SVC_PHONE,   "Suresh (Service Manager)"),
        (SVC2_PHONE,  "Deepa (Service Manager)"),
        (ADMIN_PHONE, "Anand (Admin)"),
    ]
    tokens: dict[str, str] = {}
    for phone, label in staff_logins:
        _, sp = expect(200, "POST", "/api/v1/auth/staff-login",
                       f"Staff login — {label}",
                       body={"phoneNumber": phone, "password": STAFF_PASSWORD})
        tokens[phone] = data(sp, "data", "accessToken") or ""
    crm_token   = tokens[CRM_PHONE]
    svc_token   = tokens[SVC_PHONE]
    admin_token = tokens[ADMIN_PHONE]

    expect(401, "POST", "/api/v1/auth/staff-login",
           "Staff login — wrong password (negative)",
           body={"phoneNumber": ADMIN_PHONE, "password": "nope"})

    # 2. Profile ------------------------------------------------------------
    banner("2. Users / Profile")
    expect(200, "GET", "/api/v1/users/me", "Customer profile (self)", token=cust_token)
    expect(200, "PUT", "/api/v1/users/me", "Update customer email",
           body={"email": "aarav.reddy@example.com"}, token=cust_token)
    expect(401, "GET", "/api/v1/users/me", "No token (negative)",
           also_accept=(403,))

    # 3. Properties ---------------------------------------------------------
    banner("3. Properties")
    _, p = expect(200, "GET", "/api/v1/properties",
                  "List my properties", token=cust_token)
    seed_property = data(p, "data", "0", "id")

    expect(200, "GET", f"/api/v1/properties/{seed_property}",
           "Property detail (seeded)", token=cust_token)

    _, p = expect(201, "POST", "/api/v1/properties", "Create property",
                  body={"label": "API Test Plot", "addressLine1": "42 API Street",
                        "city": "Hyderabad", "pincode": "500081",
                        "propertyType": "COMMERCIAL", "isPrimary": False},
                  token=cust_token, also_accept=(200,))
    new_prop_id = data(p, "data", "id")
    if new_prop_id:
        CREATED_PROPERTY_IDS.append(new_prop_id)

    expect(200, "PUT", f"/api/v1/properties/{new_prop_id}",
           "Update property label",
           body={"label": "API Test Plot (renamed)"}, token=cust_token)

    # 4. AC Units -----------------------------------------------------------
    banner("4. AC Units")
    _, p = expect(200, "GET", f"/api/v1/properties/{seed_property}/ac-units",
                  "List AC units on seeded property", token=cust_token)
    ac_id = data(p, "data", "0", "id")

    _, p = expect(201, "POST",
                  f"/api/v1/properties/{new_prop_id}/ac-units",
                  "Create AC unit on new property",
                  body={"roomLabel": "API Test Room", "acType": "SPLIT",
                        "brand": "Daikin", "modelNumber": "FTKM50UV",
                        "tonnage": 1.5, "energyStarRating": 5},
                  token=cust_token, also_accept=(200,))
    new_ac_id = data(p, "data", "id")
    if new_ac_id:
        CREATED_AC_UNIT_IDS.append(new_ac_id)

    expect(200, "PUT", f"/api/v1/ac-units/{new_ac_id}",
           "Update AC unit room label",
           body={"roomLabel": "API Test Room — renamed"}, token=cust_token)

    # 5. Installation Requests ---------------------------------------------
    banner("5. Installation Requests")
    _, p = expect(201, "POST", "/api/v1/installation-requests",
                  "Create installation request",
                  body={"propertyId": seed_property, "propertyType": "RESIDENTIAL",
                        "acType": "SPLIT", "brand": "Daikin",
                        "modelNumber": "FTKM50UV", "tonnage": 1.5,
                        "energyRating": 5,
                        "scheduledDate": plus2, "scheduledSlot": "MORNING",
                        "notes": "API smoke-test request"},
                  token=cust_token, also_accept=(200,))
    new_install_id = data(p, "data", "id")
    if new_install_id:
        CREATED_INSTALL_IDS.append(new_install_id)

    expect(200, "GET", "/api/v1/installation-requests",
           "List my installation requests", token=cust_token)
    expect(200, "GET", f"/api/v1/installation-requests/{new_install_id}",
           "Installation detail", token=cust_token)
    expect(200, "GET", "/api/v1/installation-requests?status=PENDING",
           "Staff: list installations by status", token=admin_token)

    # 6. Service Tickets ----------------------------------------------------
    banner("6. Service Tickets")
    _, p = expect(201, "POST", "/api/v1/service-tickets",
                  "Create service ticket on seeded AC",
                  body={"acUnitId": ac_id, "problemCategory": "NOT_COOLING",
                        "errorCode": "E4",
                        "problemDescription": "API smoke-test ticket",
                        "scheduledDate": plus2,
                        "scheduledSlot": "AFTERNOON"},
                  token=cust_token, also_accept=(200,))
    new_ticket_num = data(p, "data", "ticketNumber")
    new_ticket_id  = data(p, "data", "id")
    new_ticket_assignee = data(p, "data", "currentAssigneeId")
    if new_ticket_id:
        CREATED_TICKET_IDS.append(new_ticket_id)

    # The backend auto-assigns the new ticket to whichever CRM agent is the
    # least-loaded right now; pick the matching token so the acknowledge
    # action below targets the actual assignee.
    crm_phone_by_id = {
        "b0000001-0000-0000-0000-000000000001": CRM_PHONE,
        "b0000002-0000-0000-0000-000000000002": CRM2_PHONE,
    }
    assignee_phone = crm_phone_by_id.get(new_ticket_assignee, CRM_PHONE)
    ack_token = tokens.get(assignee_phone, crm_token)

    expect(200, "GET", "/api/v1/service-tickets",
           "Customer: list my tickets", token=cust_token)
    expect(200, "GET", f"/api/v1/service-tickets/{new_ticket_num}",
           "Ticket detail (newly created)", token=cust_token)
    expect(200, "GET", f"/api/v1/service-tickets/{new_ticket_num}/sla-status",
           "Ticket SLA status", token=cust_token)
    expect(200, "GET", "/api/v1/service-tickets/AES-2026-1102",
           "Demo seed ticket (L1)", token=crm_token)
    expect(200, "GET", "/api/v1/service-tickets/AES-2026-1106",
           "Demo seed ticket (L3 — full escalation chain)", token=admin_token)

    # 7. Ticket Actions -----------------------------------------------------
    banner("7. Ticket Actions")
    expect(200, "POST", f"/api/v1/service-tickets/{new_ticket_num}/acknowledge",
           "Acknowledge (current assignee)", token=ack_token)
    expect(200, "POST", f"/api/v1/service-tickets/{new_ticket_num}/escalate",
           "Escalate L1 → L2",
           body={"reason": "API smoke test — L2 needed"}, token=ack_token)
    expect(200, "POST", f"/api/v1/service-tickets/{new_ticket_num}/escalate",
           "Escalate L2 → L3",
           body={"reason": "API smoke test — L3 needed"}, token=svc_token)
    expect(200, "POST", f"/api/v1/service-tickets/{new_ticket_num}/resolve",
           "Resolve ticket",
           body={"resolutionNotes": "API smoke test resolved",
                 "finalCharge": 1500}, token=admin_token)
    expect(200, "POST", f"/api/v1/service-tickets/{new_ticket_num}/rate",
           "Customer: rate resolved ticket",
           body={"rating": 5, "feedback": "All good — automated test"},
           token=cust_token)

    # 8. AMC ----------------------------------------------------------------
    banner("8. AMC")
    _, p = expect(200, "GET", "/api/v1/amc/my-contracts",
                  "Customer: my AMC contracts", token=cust_token)
    contracts = data(p, "data") or []
    contract_id = contracts[0]["id"] if contracts else None

    visit_id = None
    if contracts:
        for v in contracts[0].get("visits", []) or []:
            if v.get("status") == "SCHEDULED":
                visit_id = v["id"]
                break

    if contract_id:
        expect(200, "GET", f"/api/v1/amc/contracts/{contract_id}",
               "AMC contract detail", token=cust_token)
    if visit_id:
        expect(200, "POST", f"/api/v1/amc/visits/{visit_id}/schedule",
               "Reschedule AMC visit",
               body={"scheduledDate": plus10, "scheduledSlot": "AFTERNOON"},
               token=cust_token)

    # 9. Dashboards ---------------------------------------------------------
    banner("9. Dashboards")
    expect(200, "GET", "/api/v1/dashboard/customer",
           "Customer dashboard", token=cust_token)
    expect(200, "GET", "/api/v1/dashboard/crm",
           "CRM dashboard (as Ravi)", token=crm_token)
    _, p = expect(200, "GET", "/api/v1/dashboard/escalation",
                  "Escalation dashboard (as Admin)", token=admin_token)
    # Spot-check the new admin payload pieces are populated.
    if p:
        d = p.get("data") or {}
        team = d.get("teamWorkload") or []
        log = d.get("escalationLog") or []
        names_in_log = {row.get("fromUserName") for row in log if row.get("fromUserName")}
        REPORT_BUF.append(
            f"- Spot check: l1Count={d.get('l1Count')} l2Count={d.get('l2Count')} "
            f"l3Count={d.get('l3Count')} totalActive={d.get('totalActive')} "
            f"teamWorkload={len(team)} log={len(log)} "
            f"namedEscalators={sorted(names_in_log)}\n"
        )
    expect(403, "GET", "/api/v1/dashboard/escalation",
           "Escalation dashboard — denied to customer (negative)",
           token=cust_token)
    expect(403, "GET", "/api/v1/dashboard/crm",
           "CRM dashboard — denied to customer (negative)",
           token=cust_token)

    # 10. Notifications -----------------------------------------------------
    banner("10. Notifications")
    _, p = expect(200, "GET", "/api/v1/notifications",
                  "List notifications", token=cust_token)
    notifs = data(p, "data") or []
    first_notif = notifs[0]["id"] if notifs else None

    expect(200, "GET", "/api/v1/notifications/unread-count",
           "Unread notification count", token=cust_token)
    if first_notif:
        expect(200, "POST", f"/api/v1/notifications/{first_notif}/read",
               "Mark single notification read", token=cust_token)
    expect(200, "POST", "/api/v1/notifications/read-all",
           "Mark all notifications read", token=cust_token)

    # 11. Logout ------------------------------------------------------------
    banner("11. Logout")
    expect(200, "POST", "/api/v1/auth/logout", "Customer logout",
           body={"refreshToken": cust_refresh}, token=cust_token)


# ---------------------------------------------------------------------------
# Cleanup — delete every row created during the run + roll back side effects
# ---------------------------------------------------------------------------
def cleanup() -> bool:
    if not (CREATED_TICKET_IDS or CREATED_INSTALL_IDS or
            CREATED_AC_UNIT_IDS or CREATED_PROPERTY_IDS):
        return True
    if not shutil.which("psql"):
        print(f"  {YLW}⚠ psql not in PATH — skipping cleanup{END}")
        return False

    sql_parts: list[str] = ["BEGIN;"]
    if CREATED_TICKET_IDS:
        ids = ",".join(f"'{i}'" for i in CREATED_TICKET_IDS)
        sql_parts.append(f"DELETE FROM ticket_activities     WHERE ticket_id IN ({ids});")
        sql_parts.append(f"DELETE FROM ticket_escalation_log WHERE ticket_id IN ({ids});")
        sql_parts.append(f"DELETE FROM part_requests         WHERE ticket_id IN ({ids});")
        sql_parts.append(f"DELETE FROM notifications         WHERE reference_id::text IN ({ids});")
        sql_parts.append(f"DELETE FROM service_tickets       WHERE id IN ({ids});")
    if CREATED_INSTALL_IDS:
        ids = ",".join(f"'{i}'" for i in CREATED_INSTALL_IDS)
        sql_parts.append(f"DELETE FROM notifications         WHERE reference_id::text IN ({ids});")
        sql_parts.append(f"DELETE FROM installation_requests WHERE id IN ({ids});")
    if CREATED_AC_UNIT_IDS:
        ids = ",".join(f"'{i}'" for i in CREATED_AC_UNIT_IDS)
        sql_parts.append(f"DELETE FROM ac_units              WHERE id IN ({ids});")
    if CREATED_PROPERTY_IDS:
        ids = ",".join(f"'{i}'" for i in CREATED_PROPERTY_IDS)
        sql_parts.append(f"DELETE FROM properties            WHERE id IN ({ids});")
    # Restore side-effects we deliberately caused on demo rows
    sql_parts.append(
        "UPDATE users SET email='aarav@example.com' "
        "WHERE id='a0000001-0000-0000-0000-000000000001';"
    )
    sql_parts.append(
        "UPDATE amc_visits "
        "SET scheduled_date = CURRENT_DATE + INTERVAL '5 days', "
        "    scheduled_time_slot='MORNING' "
        "WHERE id='aab00003-0000-0000-0000-000000000001';"
    )
    sql_parts.append("COMMIT;")
    sql = "\n".join(sql_parts)

    env = os.environ.copy()
    env["PGPASSWORD"] = PG["pass"]
    proc = subprocess.run(
        ["psql", "-h", PG["host"], "-U", PG["user"], "-d", PG["db"],
         "-v", "ON_ERROR_STOP=1", "-q"],
        input=sql, env=env, capture_output=True, text=True,
    )
    if proc.returncode == 0:
        print(f"  {GRN}✓ cleanup complete{END} — created rows removed, demo data restored")
        REPORT_BUF.append(
            "\n## Cleanup\n\nAll rows created during this run were deleted; the demo "
            "dataset is back to its V4/V5 baseline.\n"
        )
        return True
    print(f"  {YLW}⚠ cleanup failed{END}\n    stderr: {proc.stderr.strip()}")
    REPORT_BUF.append(
        "\n## Cleanup\n\n**Cleanup failed.** Re-apply `V4__demo_reset.sql` + "
        "`V5__demo_l3_escalation.sql` to restore the demo dataset.\n"
        f"\n```\n{proc.stderr.strip()}\n```\n"
    )
    return False


# ---------------------------------------------------------------------------
# Report writer
# ---------------------------------------------------------------------------
def write_report() -> None:
    head = (
        "# AES Customer Portal — API Test Report\n\n"
        f"_Generated {dt.datetime.now().strftime('%Y-%m-%d %H:%M:%S %Z')} "
        "by `scripts/api_test.py`._\n\n"
        f"- **Base URL:** `{API_BASE}`\n"
        "- Each test below records the HTTP method, path, status code, request body "
        "(when sent) and a truncated 500-byte response sample.\n\n"
        "---\n"
    )
    summary = (
        "\n## Summary\n\n"
        f"- **Total:** {CTR.passed + CTR.failed}\n"
        f"- **Passed:** {CTR.passed}\n"
        f"- **Failed:** {CTR.failed}\n"
    )
    if CTR.failures:
        summary += "\n### Failures\n\n"
        for f in CTR.failures:
            summary += f"- {f}\n"
    with open(REPORT_PATH, "w", encoding="utf-8") as fh:
        fh.write(head)
        fh.write("".join(REPORT_BUF))
        fh.write(summary)


def main() -> int:
    try:
        run_tests()
    except Exception as exc:  # noqa: BLE001 — we want to keep the cleanup running
        print(f"\n{RED}ABORT{END}: {exc!r}")
        REPORT_BUF.append(f"\n## Aborted with exception\n\n```\n{exc!r}\n```\n")
    finally:
        print("\n──────────────  Cleanup  ──────────────")
        cleanup()
        write_report()

    print("\n──────────────  Summary  ──────────────")
    print(f"  Total: {CTR.passed + CTR.failed}   "
          f"Passed: {GRN}{CTR.passed}{END}   Failed: {RED}{CTR.failed}{END}")
    print(f"  Report: {REPORT_PATH}")
    return 0 if CTR.failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
