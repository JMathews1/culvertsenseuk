---
name: CulvertSense Project Overview
description: Platform overview, client, tech stack, and key services
type: project
---

IoT flood monitoring platform for Halifax Regional Municipality (HRM). Client: Halifax Water.
5 LoRaWAN sensor nodes on culverts around Dartmouth/Halifax NS: Cole Harbour Rd, Sackville River N, Bissett Run, Lake Echo Culvert, Lawrencetown.

**Why:** Pilot project (Year 1 of 12) replacing manual culvert inspections with continuous IoT monitoring.

**Stack:**
- ChirpStack v4 LoRaWAN network server
- RAK7289V2 gateway at Burnside Depot
- InfluxDB for time-series sensor data
- PostgreSQL (ChirpStack) + Redis
- FastAPI service at `docker/services/api/` (placeholder, needs real logic)
- Next.js 14 dashboard at `dashboard/`
- Nginx reverse proxy (SSL termination)
- All services on Docker `cs-net` bridge network

**How to apply:** When suggesting changes to the stack, account for the LoRaWAN → ChirpStack → MQTT → InfluxDB → API → Dashboard data flow.
