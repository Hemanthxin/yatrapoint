# Explore World — User Web App

Budget travel planning web app (Next.js 15 + Neon Postgres + Auth.js v5).

## Stack

- **Next.js 15** (App Router, TypeScript)
- **Tailwind CSS** for styling
- **Neon PostgreSQL** via `@neondatabase/serverless`
- **Drizzle ORM** + `drizzle-kit` for migrations
- **Auth.js v5** (NextAuth) — Google OAuth + Phone OTP credentials
- **Zod** + `react-hook-form` for validation
- **bcryptjs** for OTP hashing

## Features

- Phone OTP login (6 digits, 3-min expiry, hashed in DB, attempt limited, 30 s resend cooldown)
- Google sign-in
- Protected `/dashboard` with server-side session check
- All inputs validated client-side **and** server-side with Zod

## First-time setup

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in DATABASE_URL + Google keys
copy .env.example .env.local      # PowerShell / cmd
# (or: cp .env.example .env.local)

# 3. Generate a secret for Auth.js
#    Paste output into AUTH_SECRET in .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 4. Push the schema to Neon
npm run db:push

# 5. Run the dev server
npm run dev
```

Open http://localhost:3000.

## Environment variables

See [.env.example](.env.example). The required ones to start:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Neon pooled connection string |
| `AUTH_SECRET` | yes | JWT signing secret |
| `AUTH_URL` | dev | Base URL (`http://localhost:3000`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | for Google | OAuth client (Web) |
| `OTP_PROVIDER` | yes | `mock` (default) or `msg91` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | for car-booking push alerts | Web Push keys — generate once with `npx web-push generate-vapid-keys`; subject is `mailto:you@domain`. Without them alerts fall back to polling |
| `SAAFERA_URL` | driver app only | (set on the Saafera Captain app) the live Saafera origin it talks to |

### OTP in dev (mock provider)

With `OTP_PROVIDER=mock`, OTPs print to the **server console**. Watch the
`npm run dev` terminal — you'll see lines like:

```
[MOCK OTP]  phone=9876543210  code=482190  (provider=mock)
```

Switch to `OTP_PROVIDER=msg91` and fill `MSG91_*` to send real SMS.

### Google OAuth

1. https://console.cloud.google.com/apis/credentials → **Create credentials → OAuth client ID → Web**
2. Authorized JS origins: `http://localhost:3000`
3. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy Client ID/Secret into `.env.local`

## Project layout

```
src/
├── app/
│   ├── page.tsx                    Landing + phone/Google login
│   ├── verify-otp/page.tsx         OTP entry screen
│   ├── dashboard/page.tsx          Protected user home
│   └── api/
│       ├── auth/[...nextauth]/     Auth.js handlers
│       └── otp/send/               POST /api/otp/send
├── auth.ts                         NextAuth config (Google + phone-otp)
├── middleware.ts                   /dashboard protection
├── components/                     UI (Hero, PhoneLoginCard, OtpCard, ...)
└── lib/
    ├── db/                         Drizzle client + schema
    ├── otp/                        OTP service + provider abstraction
    ├── validators.ts               Zod schemas (phone, OTP)
    └── utils/id.ts                 id generator
```

## Database

Drizzle owns the schema in [src/lib/db/schema.ts](src/lib/db/schema.ts).

```bash
npm run db:generate   # write SQL migration files to ./drizzle
npm run db:push       # push schema directly to Neon (dev shortcut)
npm run db:studio     # open Drizzle Studio
```

Tables: `users`, `accounts`, `sessions`, `verification_tokens`, `otp_codes`.

## Validation

- Phone: 10-digit Indian mobile, starts 6–9 (`/^[6-9]\d{9}$/`)
- OTP: exactly 6 digits
- Validated on the form **and again** in every API route / `authorize()` call.

## Next steps

- Replace `BackgroundScene.tsx` with the actual hero artwork (drop into `public/` and use `next/image`).
- Wire `Destinations`, `Trip Planner`, etc. routes to real microservices per the architecture doc.
- Swap mock OTP for MSG91 (or your preferred provider) before production.
