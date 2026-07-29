---
name: verify
description: Runtime verification recipe for replai-dashboard + the replai backend (launch, drive, gotchas)
---

# Verifying replai changes at runtime

Two repos, one product: this dashboard (Next.js 16, pnpm) and the FastAPI
backend at `../replai` (uv). Both point at the **live dev Supabase** via
`.env.local` / `../replai/.env` — treat DB writes with care.

## Launch

- Backend: `cd ../replai && uv run uvicorn app.main:app --port <port>`
  (boots against real Supabase/Redis from `.env`; routes under `/api`,
  OpenAPI at `/openapi.json`).
- Dashboard: the user usually already has `next dev` on **port 3000**
  (a second `next dev` refuses to start). Client API calls go through
  `/api-proxy/api` → `INTERNAL_API_URL` (localhost:8000), so run the
  backend on 8000 if the browser UI must reach it.

## Driving surfaces without portal login

- Portal pages are auth-gated (307 → `/portal/login`). Minting Supabase
  sessions via service-role admin API is blocked by the permission
  classifier — ask the user to log in for authenticated UI flows.
- **Public widget API is the best commerce surface** (LLM-free, no
  WhatsApp sends, `web_*` visitor identity):
  1. Widget id: `widget_configs` table (shopping-enabled client
     `7cd37136-…` has seeded test products).
  2. `POST /api/public/widget/{id}/conversations` `{}` → conversation_id.
  3. `POST …/conversations/{cid}/messages` with
     `{"message":"","action":{"type":"add_to_cart","product_id":…,"quantity":1}}`
     → response carries `components` (product_grid / cart_summary /
     actions) — assert on that JSON.
- Read-only DB peeks: Supabase REST with `SUPABASE_SERVICE_ROLE_KEY`
  from `.env.local`. Products for the test client are seeded fakes;
  a temporary stock tweak (PATCH, then restore) is fine for
  low-stock-path probes.

## Gotchas

- `/internal/*` cron endpoints run REAL sweeps that can send WhatsApp —
  only probe them with a wrong `x-reminders-secret` (expect 401).
- Backend tests: several files fail on missing pytest-asyncio markers
  (pre-existing); `tests/test_webhook.py` needs a live server on 8000.
- Migrations in `../replai/migrations/` are applied manually; code
  degrades gracefully when `carts`/`order_events` tables are missing
  (warning in server log), so a passing flow doesn't prove the
  migration was applied.
