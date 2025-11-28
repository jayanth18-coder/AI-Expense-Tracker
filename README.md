
Expense Whisperer — AI-Powered Expense Tracker
README — Single-file reference for architecture, setup, schema, flows, and run instructions.

Full-stack blueprint for an AI-powered expense tracker: React + Vite + TypeScript frontend, Supabase (Auth + Postgres with RLS), Node/Express backend (import + AI chat), and FastAPI parser (PDF/Excel → structured transactions).
Intended for local development: Vite (frontend), Node on 3001, FastAPI on 3002.

--------------------------------------------------
Table of contents
--------------------------------------------------
1. Project overview
2. High-level features
3. Architecture (text)
4. Tech stack
5. Supabase schema & RLS policies (SQL)
6. Folder structure
7. Data models / TypeScript interfaces
8. Key pages & API endpoints (what they do)
9. Environment variables (examples)
10. Run locally (commands & ports)
11. Implementation & security notes
12. Troubleshooting tips
13. Next steps & enhancements
14. License

--------------------------------------------------
1 — Project overview
--------------------------------------------------
Expense Whisperer is a full-stack web app that helps users track income and expenses, import bank statements (PDF/Excel), automatically parse and categorize transactions via an AI-aided parser, and chat with a personal AI assistant that answers questions about their own transactions only.

Primary goals:
- Secure sign up / sign in (Supabase).
- Create a financial profile (income, estimates, currency).
- Manual add/edit income & expenses.
- Upload bank statements; AI parses and suggests categories.
- Editable import UI (review rows before writing to DB).
- AI chat that answers questions using only the user's transactions.

--------------------------------------------------
2 — High-level features
--------------------------------------------------
- Email/password auth via Supabase.
- On signup: profile creation flow (ProfileCreate).
- Protected routes for dashboard and AI features.
- Dashboard: total income, total expense, net balance, recent transactions, category breakdown, charts.
- Manual transaction CRUD (income & expenses).
- AI Expense Sync: upload PDF/Excel → parser returns structured ParsedResult → editable table → import selected rows to Supabase.
- AI chatbot panel: uses recent transactions (server fetched) + system prompt to call an LLM and return answers.

--------------------------------------------------
3 — Architecture (text)
--------------------------------------------------
[Browser - Frontend (Vite + React + TS)]
   - Auth, Dashboard, Manual Txn pages
   - AI Expense Sync (upload + table) + Chat panel

[Node Backend - Express (port 3001)]
   - POST /api/import   -> validates user, writes transactions to Supabase
   - POST /api/chat     -> fetches user txns, calls LLM, returns answer
   - (Optional) other admin/RPC endpoints

[FastAPI Parser (port 3002)]
   - POST /api/analyze-expenses -> accepts file (pdf/xlsx/csv) and returns ParsedResult JSON

[Supabase (Auth + Postgres)]
   - users (auth)
   - profiles
   - categories
   - transactions

--------------------------------------------------
4 — Tech stack
--------------------------------------------------
Frontend:
- React + Vite + TypeScript
- React Router v6
- shadcn-ui / Radix + Tailwind CSS
- React Query (TanStack Query)
- Chart library: chart.js or Recharts
- Toasts: Sonner (or similar)

Backend:
- Node.js + Express (TypeScript)
  - Verifies Supabase user token
  - Writes to Supabase (service_role key OR user's JWT + RLS)
  - Calls LLM (OpenAI-compatible endpoint like Groq / OpenAI)
- Python FastAPI
  - PDF/Excel parsing (pdfplumber / camelot / tabula / pandas / pytesseract)
  - Returns structured JSON

Database / Auth:
- Supabase (Postgres) with RLS policies

AI:
- OpenAI-compatible chat completions (Groq, OpenAI, etc.)

--------------------------------------------------
5 — Supabase schema & RLS policies (SQL)
--------------------------------------------------
Paste into Supabase SQL editor. Adjust names/types to taste.

-- profiles table
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  display_name text,
  monthly_income numeric,
  monthly_expenses_estimate numeric,
  currency text default 'USD',
  created_at timestamptz default now()
);

-- categories table (global defaults: user_id null)
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  name text not null,
  type text check (type in ('income','expense')) not null,
  created_at timestamptz default now()
);

-- transactions table (single table for income & expenses)
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  date date not null,
  merchant text,
  category_id uuid references categories(id),
  amount numeric not null,
  type text check (type in ('debit','credit')) not null, -- debit = out, credit = in
  source text,
  raw_line text,
  flagged boolean default false,
  created_at timestamptz default now()
);

create index on transactions(user_id, date);

-- Enable Row Level Security
alter table profiles enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;

-- Profiles: owner-only
create policy "profiles_owner" on profiles
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Categories: read global + user's, manage only user's
create policy "categories_select" on categories
  for select
  using (user_id is null OR user_id = auth.uid());

create policy "categories_manage" on categories
  for insert, update, delete
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Transactions: owner-only full access
create policy "transactions_owner_full" on transactions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

--------------------------------------------------
6 — Folder structure (recommended)
--------------------------------------------------
root/
  frontend/
    package.json
    src/
      main.tsx
      App.tsx
      routes/
        Auth.tsx
        Dashboard.tsx
        AIExpenseSync.tsx
      components/
      lib/supabase.ts
      types/index.ts

  expense-backend/
    package.json
    src/
      server.ts
      routes/import.ts
      routes/chat.ts
      lib/supabaseClient.ts

  expense-parser/
    pyproject.toml / requirements.txt
    main.py
    parsers/
      pdf_parser.py
      excel_parser.py

--------------------------------------------------
7 — Data models / TypeScript interfaces (canonical)
--------------------------------------------------
Save in src/types/index.ts and mirror on backend for type safety.

export type TxnType = 'debit'|'credit';

export interface ParsedExpense {
  id: string;
  date: string;       // YYYY-MM-DD
  merchant: string;
  category?: string;
  category_id?: string | null;
  amount: number;
  type: TxnType;      // debit = expense, credit = income
  flagged?: boolean;
  raw_line?: string;
}

export interface ParsedResult {
  summary: {
    total_income: number;
    total_expense: number;
    net: number;
    count: number;
  };
  categories: { name: string; total: number }[];
  expenses: ParsedExpense[];
  unparsed: string[];
}

export interface Profile {
  display_name?: string;
  monthly_income?: number;
  monthly_expenses_estimate?: number;
  currency?: string;
}

--------------------------------------------------
8 — Key pages & API endpoints
--------------------------------------------------
Frontend pages:

- Auth (/auth):
  - Sign In / Sign Up tabs.
  - On signup redirect to /profile-create.

- ProfileCreate (/profile-create):
  - Capture basic financial profile.

- Dashboard (/dashboard):
  - Summary cards (total income/expense/net).
  - Recent transactions list.
  - Charts and category breakdown.

- Manual transactions (/transactions/new, /transactions/:id/edit):
  - Forms for income/expense with category selection.

- AI Expense Sync (/sync):
  - Upload PDF/Excel file.
  - Show parser ParsedResult: summary cards, category breakdown.
  - Editable table with checkboxes, editable merchant/category, type badge, flag indicator.
  - Import selected rows via POST /api/import.
  - Toasts for success/error.
  - Right-side chat panel for AI chat.

Backend API (Node/Express on port 3001):

- GET /api/health
  - Health check endpoint.

- POST /api/import
  - Body: { rows: ParsedExpense[] }.
  - Auth: Authorization: Bearer <supabase access token>.
  - Validates user and inserts into transactions table.

- POST /api/chat
  - Body: { question: string }.
  - Auth: Authorization: Bearer <supabase access token>.
  - Fetches recent transactions, builds system + user prompt, calls LLM, returns { answer }.

FastAPI parser (port 3002):

- POST /api/analyze-expenses
  - multipart/form-data with file (pdf/xlsx/csv).
  - Returns ParsedResult JSON:
    - summary: totals & counts
    - categories: list of {name, total}
    - expenses: array of parsed rows (including id)
    - unparsed: lines that couldn't be parsed

--------------------------------------------------
9 — Environment variables (examples)
--------------------------------------------------
Frontend (.env):
  VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
  VITE_SUPABASE_ANON_KEY=public-anon-key
  VITE_BACKEND_URL=http://localhost:3001
  VITE_PARSER_URL=http://localhost:3002

Node backend (.env):
  PORT=3001
  SUPABASE_URL=https://your-supabase-url.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
  LLM_API_URL=https://api.groq.example/v1/chat/completions
  LLM_API_KEY=your_llm_api_key
  LLM_MODEL=gpt-4o-mini

FastAPI (.env or config):
  PORT=3002
  LLM_API_KEY=...
  LLM_API_URL=...

Note: SUPABASE_SERVICE_ROLE_KEY must never go to the frontend. Keep it server-side only.

--------------------------------------------------
10 — Run locally (quick start)
--------------------------------------------------
Prerequisites: Node 18+, npm/pnpm/yarn, Python 3.10+, Supabase project created.

1) Supabase:
   - Create project.
   - Run SQL from section 5 in the Supabase SQL editor.
   - Get SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.

2) Start FastAPI parser (port 3002):
   cd expense-parser
   python -m venv .venv
   source .venv/bin/activate      # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --reload --port 3002

3) Start Node backend (port 3001):
   cd expense-backend
   npm install
   # create .env with SUPABASE_SERVICE_ROLE_KEY and LLM keys
   npm run dev

4) Start Frontend (Vite):
   cd frontend
   npm install
   # create .env with VITE_ vars
   npm run dev

Ports used:
- Frontend (Vite): default (e.g., 5173)
- Node backend: 3001
- FastAPI parser: 3002

--------------------------------------------------
11 — Implementation & security notes
--------------------------------------------------
Auth flow:
- Frontend uses Supabase anon key for sign in.
- Session includes access token (JWT).
- Frontend sends Authorization: Bearer <access_token> to Node backend.
- Node verifies token via Supabase and writes using service_role key or user JWT with RLS.

RLS:
- Ensures users only access their own profiles and transactions.
- Test with real JWTs, not the service role key.

LLM & privacy:
- Only send minimal necessary transaction data to the LLM (e.g., last 90 days summarized).
- Inform users what data is sent.
- Prefer privacy-conscious LLM options if possible.
- System prompt must instruct the model to use only provided transactions.

File parsing:
- PDF parsing can be brittle; support both table extraction and OCR.
- For large files, consider background jobs instead of synchronous parsing.

Dates:
- Normalize to YYYY-MM-DD before DB insert.
- Validate dates server-side.

Error handling / idempotency:
- Avoid duplicate imports (merchant + date + amount checks).
- Provide clear error messages to the user.

Rate limiting:
- Add rate limiting for LLM calls and heavy parsing work.

Secrets:
- Do not commit service_role or LLM keys to version control.
- Use environment variables or a secret manager.

--------------------------------------------------
12 — Troubleshooting tips
--------------------------------------------------
- 401 from Node endpoints:
  - Ensure Authorization header is present and correct.
  - Confirm access_token from Supabase session is being used.

- Parser returning empty or errors:
  - Test with a simple CSV/Excel first.
  - Check that the file is correctly sent as multipart/form-data.

- RLS denies inserts/selects:
  - Confirm user_id in payload matches auth.uid() in policies.
  - Test using Supabase SQL console with the same JWT.

- LLM returns irrelevant answers:
  - Tighten system prompt.
  - Reduce number of transactions in prompt.
  - Add explicit instructions to compute only from provided data.

--------------------------------------------------
13 — Next steps & enhancements
--------------------------------------------------
- Add background worker and queue for heavy parsing (Redis, etc.).
- Implement reconciliation between imported and manual transactions.
- Add multi-currency support with FX conversions.
- Allow receipts upload with OCR extraction.
- Implement export (CSV/Excel) and scheduled email reports.
- Add CI/CD pipeline, API tests, and E2E tests.
- Optionally create a docker-compose.yml for local multi-service setup.

--------------------------------------------------
14 — License
--------------------------------------------------
MIT License — you are free to use, modify, and distribute this project, subject to the terms of the MIT license.

End of README.