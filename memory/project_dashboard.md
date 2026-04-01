---
name: CulvertSense Dashboard
description: Next.js 14 dashboard details — file structure, design tokens, key decisions
type: project
---

Built at `dashboard/` (inside the infra repo). Production Next.js 14 App Router app.

**Design tokens (exact, from HTML mockup):**
- `--bg:#080d0f` `--surface:#0e1518` `--surface2:#131d21` `--surface3:#1a2630`
- `--teal:#00c4a0` (normal), `--amber:#f5a623` (warning), `--red:#e8453c` (critical)
- `--blue:#3d9cf5`, `--green:#4caf7d` (savings)
- Fonts: JetBrains Mono (data/mono), DM Sans (UI) via next/font/google

**Tech stack:** Next.js 14, TypeScript, Tailwind CSS, Chart.js + react-chartjs-2, SWR (30s polling)

**Key env vars:**
- `NEXT_PUBLIC_API_URL` — base URL for real API
- `NEXT_PUBLIC_USE_MOCK_DATA=true` — switches to mock data (set true for dev)

**API routes (via nginx → FastAPI):**
- `GET /api/v1/sensors` — all sensor readings
- `GET /api/v1/sensors/{id}/history?days=7` — time series
- `GET /api/v1/alerts` — alert history
- `GET /api/v1/thresholds` — GET/POST threshold config
- `GET /api/v1/gateway` — gateway status
- `GET /api/v1/savings` — YTD savings estimate

**Map:** CSS-positioned pins (not Leaflet) matching the HTML mockup exactly. 5 pins at hardcoded % positions.

**Infrastructure wiring:**
- `docker/docker-compose.override.yml` adds `dashboard` service (port 3000, internal)
- `docker/config/nginx/conf.d/chirpstack.conf` modified:
  - `upstream dashboard_backend { server dashboard:3000; }` added
  - `location /` → dashboard (catch-all)
  - `location /api/v1` → api_backend (higher specificity than /api ChirpStack block)

**How to apply:** When working on the dashboard, CSS class names are defined in `app/globals.css` (not Tailwind utilities) to match the HTML mockup. The map is CSS-only — to swap in real Leaflet, replace `components/map/NetworkMap.tsx`.
