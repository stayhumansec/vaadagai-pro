# வாடகை Pro

Tamil-language rental property management app for a landlord managing **15 rental houses in Tamil Nadu, India**.

- Tamil UI throughout — labels, buttons, messages
- Monthly rent tracking with automatic **முன் பாக்கி** (previous-balance) carry-forward
- Electricity (EB) meter reading tracker with per-house rates
- Rent revision history, applied to future months only
- PNG receipts (single + bulk), CSV/PNG ledger export
- WhatsApp payment reminders
- Google OAuth login

## Tech stack

- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS, React Router, Recharts, html2canvas
- **Backend:** Node.js + Express, SQLite (`better-sqlite3`), JWT sessions, Google OAuth (`google-auth-library`), file uploads via Multer
- **Deployment:** single Express server serving the built frontend + API, or Docker

## Project structure

```
vaadagai-pro/
├── server/     Express API, SQLite db.js + migrations, routes/
├── client/     Vite + React frontend (src/pages, src/components)
├── scripts/    new-pr.sh helper
├── Dockerfile, docker-compose.yml
└── .github/workflows/ci.yml
```

## Prerequisites

- Node.js **18+** (tested on 20/22) and npm
- A Google Cloud project, for OAuth login

## 1. Google Cloud OAuth setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a project (or pick an existing one).
2. **APIs & Services → OAuth consent screen** — configure it (External is fine for personal use), add your Google account as a test user if the app stays in "Testing" mode.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**, application type **Web application**.
4. Add an **Authorized redirect URI**:
   - Development: `http://localhost:5173/auth/callback`
   - Production: `https://your-domain.com/auth/callback`
5. Copy the generated **Client ID** and **Client Secret** — you'll need both below.

## 2. Configure environment variables

Two `.env` files, both git-ignored:

**`.env`** at the repo root (read by the server):
```bash
cp .env.example .env
```
```env
PORT=3000
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback
JWT_SECRET=your_random_secret_string_here
DB_PATH=./data/vaadagai.db
UPLOAD_PATH=./uploads/
```
Generate a strong `JWT_SECRET` with e.g. `openssl rand -hex 32`.

**`client/.env`** (read by Vite, must be prefixed `VITE_`):
```bash
cp client/.env.example client/.env
```
```env
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback
```

## 3. Development

```bash
# terminal 1 — backend (http://localhost:3000)
cd server
npm install
npm run dev

# terminal 2 — frontend (http://localhost:5173, proxies /api to :3000)
cd client
npm install
npm run dev
```

Open **http://localhost:5173** and sign in with Google.

The database schema and the 15 seed houses are created automatically the first time the server starts — no manual setup step needed. The SQLite file is written to `DB_PATH` (`./data/vaadagai.db` by default).

## 4. Production (single server)

The Express server can serve the built frontend itself, so only one process needs to run:

```bash
# build the frontend
cd client && npm install && npm run build && cd ..

# install server deps and start
cd server && npm install && npm start
```

Visit `http://localhost:3000` — the server serves the built React app for all non-`/api` routes and the REST API under `/api`.

## 5. Docker (optional)

```bash
cp .env.example .env   # fill in your real values
docker compose up --build
```

This builds the frontend, installs server dependencies, and runs everything as a single container on port 3000. The SQLite database and uploaded proof documents are kept in named volumes (`vaadagai-data`, `vaadagai-uploads`) so they survive container rebuilds.

## Scripts

| Command | Where | What |
|---|---|---|
| `npm run dev` | `server/` | Start the API with auto-restart |
| `npm start` | `server/` | Start the API (production) |
| `npm run db:seed` | `server/` | Re-run the house seed manually |
| `npm run dev` | `client/` | Vite dev server |
| `npm run build` | `client/` | Type-check + production build |

## Contributing / branch workflow

See `scripts/new-pr.sh` — every change goes through a feature branch and a squash-merged pull request into `main`. Commit messages follow conventional commits (`feat:`, `fix:`, `chore:`, `db:`, `api:`, `ui:`, `refactor:`, `docs:`).
