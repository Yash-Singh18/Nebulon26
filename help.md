# Sirius — Judge Demo Guide

This is the run-of-show for demoing **Team Tracking** to judges with 3 accounts, plus the technical breakdown of how everything works under the hood and a scaling plan.

Route: `/team-tracking` · Local frontend: `http://localhost:5174` (or whatever port Vite prints)

---

## 0. Before you start

1. Bring up the backend stack:
   ```bash
   docker compose up -d --build
   ```
   This starts `ai-service` (:8010), `rag-service` (:8011), `qdrant`, and `redis`.
2. Start the frontend separately:
   ```bash
   cd frontend && npm run dev
   ```
3. Make sure `http://localhost:5174` (and `5173`, as a fallback) is in Supabase → **Authentication → URL Configuration → Redirect URLs**, otherwise Google login will bounce to the old Railway deployment.
4. Have **3 Google accounts** ready (or 3 browser profiles / incognito windows) for id1, id2, id3 — Supabase Auth is per-Google-account, and each judge-facing "user" needs to be a distinct `auth.users` row.
5. The demo CSV is at `demo/sample_transactions_1year.csv` — 270 rows of realistic income/expense data for a small firm across the last 12 months (rent, salaries, client payments, marketing, etc.), including two deliberately oversized "anomaly" transactions to trigger the AI bot's anomaly detection later.

---

## 1. Demo script

### id1 — Founder / Room Admin

1. Log in with Google → redirected to Home → open **Team Tracking** from the navbar (`/team-tracking`).
2. Click **+ Create Room**, fill in:
   - Room Name: e.g. `Acme Textiles`
   - Description: e.g. `FY25-26 books`
   - Click **Create**.
   - id1 is automatically the **Admin** (badge shown on the room card) and lands on the room **Dashboard**.
3. Note the **Room Code** shown in the left nav under the room name (also visible in **Manage Team**) — you'll hand this to id2/id3 to join.
4. On the **Dashboard** tab, use **Upload CSV** (under "Add Transaction") to upload `demo/sample_transactions_1year.csv`.
   - Since id1 is admin, all 270 rows are inserted with `status: approved` immediately — the dashboard stats, cash-runway card, and charts populate instantly.
5. Manually add one transaction via the inline form (Amount / Type / Category / Date-Time) to show the non-CSV path — e.g. `₹12,000 · expense · Team Lunch`. As admin this also lands straight in `approved`.
6. Open the **AI Bot** tab and run a prebuilt query like **"Spot anomalies"** or **"Team summary"** to show the two seeded outlier transactions get flagged and the LLM narrates the financials.

### id2 — Team Member (joins & gets approved)

1. Log in with a second Google account (separate browser/profile).
2. On the Team Tracking landing page, click **Join Room**, enter the **Room Code** from id1, optionally set a **Department Tag** (e.g. `Sales`), click **Join**.
3. id2 lands on the room with member-level access (no **Admin Panel** tab yet).
4. Add a transaction from the **Dashboard** form (or CSV) — since id2 is not admin, it's inserted with `status: pending` and a banner says "Transaction submitted for approval."
5. Go to **Manage Team** → click **Request Admin** → banner flips to "Admin request sent!"
6. Switch back to id1's session → **Admin Panel** tab shows:
   - The pending transaction under **Pending Transactions** → click **Approve** (or **Reject**) to demonstrate the approval gate.
   - id2's request under **Admin Access Requests** → click **Grant Admin** (or **Deny**).
7. Open **Chat** as id2, send a message, `@mention` id1 by typing `@` to trigger the mention autocomplete. Switch to id1's tab — the message appears in real time with no refresh (Supabase Realtime).

### id3 — Second Team Member (repeat, faster)

1. Log in with a third account, **Join Room** with the same code, pick a different department (e.g. `Engineering`).
2. Add a transaction (goes to `pending`), post a chat message mentioning both id1 and id2.
3. From id1 (admin), approve id3's transaction from **Admin Panel**.
4. Open **Manage Team** as id1 to show the roster: 3 members, roles, departments, and the **Remove** action (don't actually remove — just point it out).
5. Back on **Dashboard**, switch time range / graph type (Line/Bar/Area/Pie) and toggle **Department** or **Category** filters to show id2's and id3's transactions now show up split by department once approved.

**Suggested narrative arc:** create → bulk-import real data → manual entry → invite teammates → approval workflow → role request workflow → realtime chat → AI analyst on top of it all. That's the full collaboration loop in ~5 minutes.

---

## 2. How it's implemented (technical walkthrough for judges)

### 2.1 Architecture at a glance

```
┌─────────────┐      Supabase JS client (direct)      ┌──────────────────┐
│  Frontend    │ ───────────────────────────────────▶ │  Supabase        │
│  (Vite/React)│                                        │  Postgres + Auth │
│  :5174       │ ◀─── Realtime (WebSocket) ───────────  │  + Realtime      │
└──────┬───────┘                                        └──────────────────┘
       │  REST (fetch)                REST (fetch)
       ▼                                     ▼
┌─────────────────┐                 ┌──────────────────────┐
│  ai-service       │                 │  rag-service            │
│  FastAPI :8010     │                 │  FastAPI :8011           │
│  Team/solo chatbot │                 │  General SME consultant  │
│  (tool-calling     │                 │  (RAG over Qdrant +      │
│   over Supabase)   │                 │   Redis session memory)  │
└────────┬───────────┘                 └──────┬──────────┬───────┘
         │ Groq API (LLM)                      │ Qdrant   │ Redis
         ▼                                     ▼          ▼
     llama-3.3-70b /                    vector store   session memory
     llama-3.1-8b (router)              (bge-small-en) (query history)
```

There are **two independent backend services**, and the frontend talks to Supabase directly for all CRUD + realtime — neither backend service sits in front of the database.

- **`ai-service`** (port 8010) — powers both the personal `AiBot` (TrackExpense) and the **Team AI Bot**. It does *not* use RAG/vector search; it's a tool-calling pipeline that queries Supabase directly for numbers.
- **`rag-service`** (port 8011) — powers the standalone **SME Expert** consultant chat (`/sme-expert`) and the floating chatbot. This is the one with the actual RAG pipeline (Qdrant + BM25 + Redis).

### 2.2 Data model (Supabase Postgres, `supabase/migrations/`)

| Table | Purpose | Key columns |
|---|---|---|
| `team_rooms` | one row per "room" | `room_code` (unique 6-char), `admin_id` |
| `team_members` | membership + role | `role` (`admin`/`member`), `department`, unique `(room_id, user_id)` |
| `team_transactions` | the ledger | `status` (`pending`/`approved`/`rejected`), `added_by`, `approved_by` |
| `team_messages` | chat | `content`, `mentions text[]` |
| `admin_requests` | role-elevation workflow | `status` (`pending`/`approved`/`rejected`), unique `(room_id, user_id)` |
| `profiles` | display name/username | 1:1 with `auth.users` |

All 5 team tables have **Row Level Security** enabled (`supabase/migrations/20260324020000_create_team_tables.sql`). Two `security definer` helper functions, `is_team_member()` and `is_team_admin()`, let RLS policies check membership without a chicken-and-egg problem (a member's own `select` policy would otherwise need to already know they're a member). A third function, `lookup_room_by_code()`, is `security definer` specifically so a **non-member** can look up a room by its join code — normal RLS would hide the room from someone not in it yet.

### 2.3 Room creation & joining

- **Create** (`services/supabase/teams.js: createRoom`): generates a random 6-char `room_code` client-side, inserts into `team_rooms` with `admin_id = auth.uid()`, then inserts a matching row into `team_members` with `role: "admin"`. Two separate inserts, no transaction/RPC — acceptable at hackathon scale but not atomic (see HLD notes).
- **Join** (`joinRoom`): calls the `lookup_room_by_code` RPC (bypasses RLS to find the room), then inserts into `team_members` with `role: "member"`. The `unique(room_id, user_id)` constraint turns a duplicate join into a friendly "You are already a member" error (Postgres error code `23505`).
- There is **no join-approval step by design** — anyone with the 6-character code becomes a member immediately. What *does* require admin approval is (a) a member's transactions and (b) a member's request to become admin — that's the "admin request" flow, not room membership.

### 2.4 Transactions: manual entry, CSV upload, and the approval gate

- **Manual** (`TeamTransactionForm.jsx`): a small form (amount/type/category/datetime-local) that calls `addTeamTransaction`.
- **CSV** (`TeamTransactionForm.jsx: handleCSV`): parsed **entirely client-side** with `papaparse` (`Papa.parse(file, { header: true })`). Expected headers: `amount,type,category,timestamp`. Rows are validated (amount must parse as a number, type must be `income`/`expense`) and invalid rows are silently dropped; valid rows are inserted in one batch via `addTeamTransactionsBatch` → a single Supabase `.insert([...])` call. **No backend service is involved in CSV ingestion at all** — it goes straight from the browser to Postgres via the Supabase client SDK, gated only by the `tx_insert` RLS policy.
- **Approval gate**: the status is decided client-side at insert time — `status = isAdmin ? "approved" : "pending"` — and enforced server-side because RLS's `tx_update` policy only allows admins to run `UPDATE`. A member can insert a `pending` row for themselves but can never flip it to `approved`; only `AdminPanel.jsx` (calling `approveTransaction`/`rejectTransaction`, which are plain `UPDATE ... SET status=...`) can do that, and RLS enforces that server-side regardless of what the client claims.
- Only `status: "approved"` transactions are counted in `TeamDashboard`'s totals/runway calc and fed to the AI Bot — pending/rejected rows are excluded so unapproved data can't skew the numbers or the chatbot's analysis.

### 2.5 Admin-request workflow (role elevation)

- `ManageTeam.jsx` → `requestAdmin()` inserts into `admin_requests` (idempotent: if a row already exists for that `(room_id, user_id)`, it's returned instead of duplicated, thanks to the unique constraint + a `maybeSingle()` existence check first).
- `AdminPanel.jsx` (admin-only tab, gated by `isAdmin` in `TeamTracking.jsx`) lists pending requests via `getAdminRequests()` and lets the admin call `handleAdminRequest(id, "approved"|"rejected")`, a plain `UPDATE admin_requests SET status = ...` gated by the `areq_update` RLS policy (`is_team_admin` only).
- **Known gap**: approving an admin request updates `admin_requests.status` but does **not** currently promote the user's `team_members.role` to `admin` or change `team_rooms.admin_id` — `isAdmin` in the UI is derived purely from `selectedRoom.admin_id === session.user.id` (`TeamTracking.jsx`). So today "Grant Admin" records the decision but doesn't yet change actual permissions — worth flagging proactively to judges as a known next step rather than letting them find it.

### 2.6 Chat

- Backed by `team_messages`. Sending is a plain `INSERT`; `@mentions` are extracted client-side with a regex (`/@(\w+)/g`) and stored as a `text[]` column (not currently used to filter/notify — just persisted).
- Realtime delivery uses **Supabase Realtime** (`teamChat.js: subscribeToMessages`), which subscribes to Postgres logical-replication `postgres_changes` events (`INSERT` on `team_messages`, filtered by `room_id`) over a WebSocket — no polling, no custom backend socket server. Both `team_messages` and `team_transactions` are added to the `supabase_realtime` publication in the migration, so transaction approvals could also be pushed live (chat is the only one currently wired to a live subscription in the UI).

### 2.7 Team AI Bot — how it answers questions about *this room's* data

This is the more interesting piece technically. Flow for a message from `TeamAiBot.jsx`:

1. Frontend POSTs `{ room_id, message, history }` to `ai-service`'s `POST /api/team-chat`.
2. **Intent classification** (`team_router.py`): a cheap, fast Groq call (`llama-3.1-8b-instant`, `temperature=0`) classifies the message into one of 11 intents (`summary`, `expense_query`, `member_analysis`, `department_analysis`, `anomaly_detection`, etc.) and extracts structured params (`period`, `category`, `tx_type`, `username`) as JSON. Each intent maps to a fixed list of backend "tools" to call.
3. **Tool execution** (`team_tools.py`): each tool is a plain Python function that queries Supabase directly with the **service-role key** (`team_data_service.py`, bypasses RLS since this is a trusted backend) — e.g. `get_team_financial_summary`, `get_team_member_spending`, `detect_team_anomalies` (a z-score outlier check per category, flags anything >2 std devs from the category mean — this is why the two large seeded transactions in the demo CSV get flagged). No vector search anywhere in this path; it's straight SQL-via-Supabase-SDK aggregation in Python.
4. **Structuring** (`team_groq_client.py: structure_team_results`): tool outputs are formatted into readable Markdown sections (not raw JSON) to keep the final LLM's context clean and cheap.
5. **Final answer**: a second Groq call (`llama-3.3-70b-versatile`, `temperature=0.3`) receives the structured data + conversation history + a system prompt instructing it to treat the data as ground truth, format currency as ₹, and stay under ~300 words. Response + `tools_used` (for the little "tool trail" shown under the chat bubble) + `intent` are returned.

This is a **two-stage, tool-calling RAG-adjacent pattern without a vector database** — it's closer to "text-to-tool-call" than classic retrieval-augmented generation, appropriate since the underlying data is structured/tabular, not unstructured documents.

### 2.8 Contrast: the *other* AI surfaces (for judges who ask "wait, is this all RAG?")

| Surface | Route/Component | Backend | Technique |
|---|---|---|---|
| Team AI Bot | `TeamAiBot.jsx` → `ai-service /api/team-chat` | ai-service | Tool-calling over Supabase (§2.7) |
| Personal AiBot | `TrackExpense/AiBot.jsx` → `ai-service /api/chat` | ai-service | Same pattern, scoped to `business_id` instead of `room_id` (`groq_client.py`/`tools.py`, the non-team twin of §2.7) |
| SME Expert / floating chatbot | `SmeExpertChat.jsx` → `rag-service /api/rag/chat` | rag-service | **Actual RAG**: hybrid vector (Qdrant, `bge-small-en-v1.5`, 384-dim) + BM25 keyword search over a static knowledge base (`rag-service/data/knowledge_base/`, ingested on container startup by `scripts/ingest.py` if the Qdrant collection is empty), with a confidence gate that falls back to a non-RAG LLM answer if retrieval confidence is low, plus Redis-backed short-term session memory and multilingual support |

So: two structured-data chatbots (ai-service) that never touch a vector store, and one genuine document-RAG consultant (rag-service) that never touches team/transaction tables. Good talking point if a judge asks "where's the RAG" while looking at the Team AI Bot.

### 2.9 Auth

Google OAuth via Supabase Auth (`services/supabase/auth.js`). `redirectTo: window.location.origin` is correct in code — the earlier "keeps landing on Railway" issue was a Supabase-dashboard config (redirect allowlist), not application code, since Supabase only honors `redirectTo` values present in **Authentication → URL Configuration → Redirect URLs**.

---

## 3. High-Level Design — scaling this for many concurrent users

Today's architecture is intentionally simple (2 stateless FastAPI services + managed Postgres + direct client-to-DB access) which is actually a **strong starting point** for scaling — most of the hard state lives in Supabase, which already handles a lot of this. Here's how each layer grows:

### 3.1 Frontend

- Already static (Vite build) → serve from a CDN (Vercel/Netlify/Cloudflare Pages) instead of a single Railway container. Fully horizontally scalable for free — no server-side rendering, no session affinity needed.
- Realtime chat/transactions are WebSocket subscriptions straight to Supabase, so frontend scaling doesn't add backend fan-out cost.

### 3.2 Database & Realtime (Supabase / Postgres)

This is the layer that matters most under load, since the frontend talks to it directly for every CRUD operation:

- **Connection pooling**: Supabase's pooler (pgbouncer, transaction mode) already fronts Postgres — verify pool size is tuned as concurrent room activity grows; this is usually the first bottleneck, not CPU.
- **Read replicas**: dashboard/graph queries (`getTeamTransactions`, member spending) are read-heavy and don't need read-your-writes consistency for most views — route them to a read replica once write volume on the primary grows.
- **Realtime fan-out**: Supabase Realtime scales per-project by adding replication slots/nodes; the practical limit to watch is concurrent WebSocket connections and `postgres_changes` throughput per room. If rooms get very large (100s of concurrent members), consider batching/throttling transaction-approval broadcasts rather than per-row events.
- **RLS overhead**: every query re-evaluates `is_team_member`/`is_team_admin` (SQL functions, marked `stable` so they're cached per-statement) — fine at current scale; if it becomes measurable, denormalize a `room_id` array onto `auth.users` app_metadata or cache membership in a materialized view refreshed on membership change.
- **Partitioning**: `team_transactions` and `team_messages` are the two tables that grow unboundedly with usage. Partition by `room_id` hash or by month once rows are in the millions; the existing indexes (`idx_team_tx_room`, `idx_team_tx_timestamp`) already support the common access patterns.
- **Atomicity fix**: wrap `createRoom`'s two inserts (room + admin membership) in a Postgres RPC/transaction instead of two sequential client calls, so a network blip mid-creation can't leave an orphaned room with no admin member — increasingly important as concurrent creates increase the odds of a partial failure.

### 3.3 ai-service & rag-service

Both are stateless FastAPI apps — the easy part of scaling:

- **Horizontal scaling**: run N replicas behind a load balancer (Railway/Fly/ECS/K8s all support this trivially since there's no in-process session state — Redis already holds rag-service's session memory externally).
- **rag-service specifics**:
  - Qdrant and Redis currently run as sidecar containers in `docker-compose.yml` — for production, move to **managed Qdrant Cloud** and **managed Redis** (ElastiCache/Upstash) so they scale independently of the API replicas and survive a redeploy without losing the vector index / session cache.
  - The embedding model (`bge-small-en-v1.5`, 384-dim) runs in-process via `fastembed` (ONNX) — CPU-bound and adds latency per request; at higher QPS, move embedding to a dedicated batched embedding worker/queue, or use a hosted embeddings API, so the FastAPI request threads aren't blocked on model inference.
  - Add a Qdrant HNSW `ef`/replica tuning pass and shard the collection once the knowledge base grows well past what fits comfortably in one node's RAM.
- **ai-service specifics**:
  - Every chat message currently makes 2 sequential Groq calls (router + final answer) — under load, this is mostly bound by Groq's own rate limits, not your infra. Mitigate with: multiple Groq API keys round-robined (rag-service's `config.py` already shows the pattern with `GROQ_API_KEY_1/2/3` — extend the same to ai-service), and a lightweight in-memory or Redis cache for repeated intent classifications of common phrasings ("team summary", "who spends most").
  - The service-role Supabase key used here bypasses RLS — as replica count grows, make sure this key is only ever injected via secrets manager / env, never bundled client-side (it currently isn't — good — just flagging as a scaling-time secrets-hygiene checkpoint since more replicas = more places the env can leak from).
- **Rate limiting & abuse protection**: put an API gateway (Kong/Cloudflare/simple FastAPI middleware) in front of both services once they're public — CSV upload path bypasses them entirely today (goes browser→Supabase direct), so backend rate limiting only covers the two chat endpoints; Supabase's own RLS + per-project rate limits are the actual backstop for the CSV/CRUD path, so make sure those project-level limits are configured deliberately rather than left at defaults.

### 3.4 Suggested target topology at "many users" scale

```
                         ┌─────────────┐
                         │   CDN/Edge   │  (static frontend)
                         └──────┬───────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        │                                                  │
        ▼                                                  ▼
┌──────────────┐                                  ┌──────────────────┐
│  Supabase      │◀──── direct CRUD + Realtime ───│  Browser clients   │
│  (Postgres +   │      WebSocket subscriptions    └────────┬──────────┘
│  pooler +      │                                            │ REST
│  read replica  │                                            ▼
│  + Realtime)   │                                  ┌───────────────────┐
└───────┬────────┘                                  │  Load Balancer      │
        │                                            └─────────┬───────────┘
        │ service-role REST                          ┌─────────┴─────────┐
        ▼                                             ▼                   ▼
┌────────────────┐                          ┌────────────────┐  ┌────────────────┐
│ ai-service ×N    │◀── Groq (multi-key) ──▶│ ai-service ×N    │  │ rag-service ×N    │
│ (stateless)       │                          │ (stateless)       │  │ (stateless)       │
└────────────────┘                          └────────────────┘  └───────┬────────┘
                                                                            │
                                                              ┌─────────────┴─────────────┐
                                                              ▼                             ▼
                                                     Managed Qdrant Cloud          Managed Redis
                                                     (sharded, replicated)          (session memory)
```

**Bottom line**: because the frontend already talks to Supabase directly instead of proxying everything through a custom backend, the system scales in the way Supabase itself scales (pooling, replicas, Realtime capacity) for 90% of the app's traffic (room CRUD, transactions, chat). The two FastAPI services only need to scale for the AI chat surfaces, and both are already stateless, so it's a straightforward "add replicas + externalize Qdrant/Redis + round-robin the Groq keys" story rather than a rearchitecture.
