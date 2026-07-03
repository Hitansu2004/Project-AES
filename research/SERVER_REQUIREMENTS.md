# AES Service Application — Server Requirements

**Project:** AES Service Application (Professional Tier)
**For:** Arial Engineering Services — on-premise / physical server
**Hosting:** All 4 environments (Dev / QA / Staging / Production) on a single dedicated server, isolated via Docker
**Date:** 10 June 2026

---

## Core specification

| Component | Requirement |
|---|---|
| **CPU** | **20 – 30 cores / threads total**  (e.g. AMD EPYC 7313P 16C/32T  OR  Intel Xeon Silver 4410Y 12C/24T) |
| **RAM** | **64 GB DDR4 / DDR5 ECC** (server-grade, error-correcting) |
| **Storage — Boot** | 240 GB M.2 NVMe SSD (OS + Docker engine) |
| **Storage — Data** | **1 TB NVMe SSD total** (2× 512 GB or 2× 1 TB in RAID 1 mirror — enterprise grade) |
| **RAID controller** | Hardware RAID with battery-backed write cache |
| **Power Supply** | Dual redundant hot-swap PSU (800 W Platinum) |
| **Network** | 2× 1 GbE NIC (bonded for failover) + 1 static public IPv4 |
| **Remote management** | iDRAC / iLO / IPMI (out-of-band console, mandatory) |
| **Operating System** | Ubuntu Server 22.04 LTS (Long-Term Support) |
| **Form factor** | 1U rack server (Dell PowerEdge R660xs / HPE ProLiant DL360 Gen11 / Lenovo ThinkSystem SR630 V3) |
| **Warranty** | 3-year on-site Next-Business-Day support |

---

## Supporting infrastructure (mandatory)

| Item | Requirement | Purpose |
|---|---|---|
| **UPS** | Online double-conversion, ≥ 2200 VA (e.g. APC Smart-UPS SRT 2200VA) | Clean power + 20 min graceful shutdown on outage |
| **NAS / Backup target** | 2-bay NAS with 2× 4 TB drives in RAID 1 (e.g. Synology RS1221+) | Daily off-server backup of database + uploads + configs |
| **Off-site cloud backup** | Backblaze B2 / Wasabi (~500 GB) | Disaster recovery — ~₹3,000/year |
| **Firewall** | Sophos XGS 87 / FortiGate 40F / pfSense | Block brute-force, port-scanning, basic DDoS |
| **Network switch** | 10-port managed Gigabit (Cisco / TP-Link) | VLAN isolation + traffic monitoring |
| **Server rack** | 12U–18U rack with cable management | Organised housing for server + UPS + NAS + switch |

---

## Internet / ISP

| Item | Requirement |
|---|---|
| **Connection type** | Business fibre leased line (Airtel / Tata / Jio / ACT Business) |
| **Bandwidth** | **≥ 100 Mbps symmetric** (200 Mbps recommended) |
| **Static IPv4** | 1 mandatory (required for SSL + DNS) |
| **Uptime SLA** | ≥ 99.5% with 4-hour fault response |
| **Backup link (recommended)** | Second fibre from a different ISP, or 4G/5G failover router |

---

## Server room — environment

| Item | Requirement |
|---|---|
| **Power circuit** | Dedicated 16 A circuit (not shared with office appliances) |
| **Temperature** | Maintained 18 – 25 °C — 1.5-ton split AC running 24×7 |
| **Physical security** | Locked room, biometric / RFID access, CCTV |
| **Fire safety** | Smoke detector + clean-agent (FM-200 / Novec / CO₂) extinguisher |
| **Power consumption** | ~300 W average, ~600 W peak |

---

## Why these numbers (quick justification)

| Resource | Why this much |
|---|---|
| **20–30 cores** | Production Spring Boot + PostgreSQL spike to 6–8 cores together. Multiply by 4 environments + OS + Docker + monitoring + CI runner → 20+ cores. 30 cores gives proper burst headroom. |
| **64 GB RAM** | Steady use ~22 GB across all 4 envs. 64 GB leaves ~40 GB free for OS page cache (PostgreSQL benefits hugely), GC spikes, future modules, and 5× user growth. |
| **1 TB NVMe data SSD** | DB grows to ~150 GB in 2 years + user uploads (engineer photos, AMC PDFs, invoices) ~150 GB + 7-day backups ~100 GB + logs ~50 GB + headroom ~500 GB. |
| **NVMe (not SATA SSD)** | PostgreSQL is IOPS-hungry. NVMe gives 10× the random-IO of SATA SSD — critical for reporting/analytics queries. |
| **ECC RAM** | Silently flips bits without ECC → silent DB corruption. Non-negotiable on a database host. |
| **Dual PSU + UPS** | Power loss mid-write = corrupted PostgreSQL = downtime + data loss. |
| **RAID 1 mirror** | If one SSD dies, the other carries on. Hot-swap = replace without downtime. |
| **BMC / iDRAC** | When OS hangs at 11 PM, you fix it remotely without going on-site. Without BMC, every outage needs a physical visit. |

---

## Headroom for future development

The 64 GB RAM / 30-core / 1 TB spec comfortably absorbs:

- ✅ Phase 2: Inventory module, accounting integration, multi-language, IoT telemetry
- ✅ Scaling from 2,000 → 10,000 users
- ✅ AI / recommendation engine (Python container)
- ✅ Real-time analytics expansion
- ⚠️ Beyond 25,000 users — simple in-place upgrade to 128 GB RAM (cheap, slots reserved)

---

## Cost summary

| Category | Range |
|---|---|
| **Day-1 CapEx** (server + UPS + NAS + firewall + switch + rack + ISP install) | **₹5.5 – 7.0 lakhs** |
| **Annual OpEx** (internet + electricity + AC + cloud backup, Years 1–3 with warranty included) | **₹1.1 – 1.7 lakhs / year** |
| **5-year TCO** (CapEx + 5 years OpEx + Year-4 warranty extension) | **~₹14 lakhs** (~₹23,000/month amortised) |

---

## One-line summary

> **1U rack server — 20–30 CPU cores, 64 GB ECC RAM, 1 TB NVMe SSD (RAID 1), dual redundant PSU, iDRAC/iLO remote management, Ubuntu 22.04 LTS — paired with an APC Smart-UPS, a Synology NAS for backups, a Sophos firewall, and a 100 Mbps symmetric business fibre with static IP. Carries Arial through 2+ years of growth and all Phase 2 modules without bottlenecking.**

*Prepared by Arial Engineering Solution — Mahender Vengala & Hitansu Parichha*
