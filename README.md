
# Group Organizer SaaS App

Group Organizer is a small SaaS-style web app for creating groups, sharing join links (and QR codes), and managing group details with both anonymous and authenticated flows.

This codebase was originally generated from a Figma design export and then wired to a lightweight backend using Supabase (auth + edge functions).

## Tech Stack

- Frontend: Vite + React + TypeScript
- UI: Tailwind CSS, Radix UI, MUI icons, Sonner toasts
- Routing: React Router
- Backend: Supabase (Auth + Edge Functions)
- Payments (optional): Stripe (Edge Function endpoints)

## Project Structure

- `src/`: React app source
- `src/app/routes.tsx`: Route map
- `utils/supabase/info.tsx`: Supabase project ID + anon key (see security note below)
- `supabase/functions/`: Supabase Edge Function(s) used by the app
- `netlify.toml`: Netlify build config + SPA redirect

## Getting Started (Local Dev)

Prereqs:

- Node.js 18+ recommended
- npm (or your preferred package manager, but this repo includes `package-lock.json`)

Install deps:

```bash
npm install
```

Set environment variables (frontend):

1. Copy `.env.example` to `.env`
2. Fill in:
   - `VITE_SUPABASE_URL` (or `VITE_SUPABASE_PROJECT_ID`)
   - `VITE_SUPABASE_ANON_KEY`

Run dev server:

```bash
npm run dev
```

Then open:

- `http://localhost:5173/`

Build for production:

```bash
npm run build
```

The production output is written to `dist/` (ignored by git).

## Backend (Supabase)

This repo includes an Edge Function under `supabase/functions/make-server-1a98deae/` used for signup/auth helpers and other server-side actions.

Common environment variables referenced by the Edge Function:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (sensitive, never commit)
- `STRIPE_SECRET_KEY` (sensitive, never commit)
- `STRIPE_WEBHOOK_SECRET` (sensitive, never commit)

How you run/deploy the Edge Function depends on your Supabase setup (CLI vs Dashboard). Treat this repo as the source for the function code; secrets should live in Supabase environment variables, not in git.

## Deployment (Netlify)

The repo already includes a `netlify.toml`:

- Build command: `npm run build`
- Publish directory: `dist`
- SPA redirect: `/* -> /index.html`

To deploy:

1. Create a new site in Netlify and connect this GitHub repo.
2. Netlify should auto-detect the build settings from `netlify.toml`.

## Screenshots

Add snapshots under `docs/screenshots/` and then update the links below.

Suggested shots to include:

- Home: `docs/screenshots/home.png`
- Login: `docs/screenshots/login.png`
- Signup: `docs/screenshots/signup.png`
- Dashboard: `docs/screenshots/dashboard.png`
- Create Group: `docs/screenshots/create-group.png`
- Group Detail: `docs/screenshots/group-detail.png`
- Join Flow: `docs/screenshots/join-group.png`
- Pricing: `docs/screenshots/pricing.png`

Placeholders (these will show as broken images until you add the files):

![Home](docs/screenshots/home.png)
![Dashboard](docs/screenshots/dashboard.png)
![Group Detail](docs/screenshots/group-detail.png)

## Security Notes (Important)

- Never commit real secrets. This repo’s `.gitignore` ignores `.env*` files and common local artifacts.
- This repo is safe to publish without hardcoded keys: Supabase client config is read from `VITE_*` env vars (see `.env.example`).
- Rotate any credentials that were ever committed or shared.

## Attribution

See `ATTRIBUTIONS.md` for third-party assets and acknowledgements.
