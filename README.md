# OFSMS

| Part | Path | Stack | Hosted on |
|---|---|---|---|
| Frontend website | `apps/frontend` | Next.js | **Vercel** |
| Backend API | `apps/backend` | Node.js + Express | **Render** |
| Database + file storage | – | PostgreSQL + S3-compatible storage | **Supabase** |

## Deploy (Supabase + Render + Vercel)

Do the steps in this order. Total time ≈ 15 minutes.

### 1. Supabase — database and file storage
1. Create a project at <https://supabase.com/dashboard> and save the database password.
2. Click **Connect** → copy the **Session pooler** connection string
   (`postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-0-….pooler.supabase.com:5432/postgres`).
   This is your `DATABASE_URL`. Tables are created automatically by the backend on first start.
3. **Storage** → **New bucket** → name it `ofsms-documents` (keep it private).
4. **Project Settings → Storage → S3 Connection**: copy the **Endpoint** and **Region**, then
   **New access key** and copy the **Access key ID** and **Secret access key**.

### 2. Render — backend
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/YousefAlgharasi/OFSMS)

1. Click the button (or Render → **New → Blueprint** → pick this repo). Render reads `render.yaml`.
2. Fill in the variables it asks for:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase Session pooler string (step 1.2) |
| `FRONTEND_URL` | your Vercel URL, e.g. `https://ofsms.vercel.app` (fill in after step 3, then redeploy) |
| `PUBLIC_API_URL` | this service's URL, e.g. `https://ofsms-backend.onrender.com` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first General Manager login (password ≥ 10 characters) |
| `S3_ENDPOINT` | Supabase S3 endpoint (step 1.4) |
| `S3_BUCKET_NAME` | `ofsms-documents` |
| `AWS_REGION` | Supabase S3 region |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Supabase S3 access key (step 1.4) |

JWT secrets are generated automatically. When it is live, open `https://<your-backend>.onrender.com/health` → `{"status":"ok"}`.

> Render's free plan sleeps after 15 min idle (first request takes ~30 s). Use a paid plan for a system that must always answer.
> PDF reports need ≈ 512 MB RAM (Chromium), so use at least the Starter plan for reports.

### 3. Vercel — frontend
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYousefAlgharasi%2FOFSMS&root-directory=apps%2Ffrontend&env=NEXT_PUBLIC_API_URL&envDescription=Backend%20API%20URL%20ending%20with%20%2Fapi&project-name=ofsms)

1. Click the button, or Vercel → **Add New → Project** → import this repo.
2. Set **Root Directory** = `apps/frontend` (the framework is detected as Next.js).
3. Add the environment variable:
   `NEXT_PUBLIC_API_URL` = `https://<your-backend>.onrender.com/api`
4. **Deploy**, then copy the Vercel URL into Render's `FRONTEND_URL` and redeploy the backend.
   If you ever change `NEXT_PUBLIC_API_URL`, redeploy the frontend (it is baked in at build time).

### 4. First login
Open the Vercel URL → **تسجيل الدخول** with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, then remove
`ADMIN_PASSWORD` from Render. Create the other users from **إدارة المستخدمين**.

### Troubleshooting
| Symptom | Fix |
|---|---|
| "Not allowed by CORS" at login | `FRONTEND_URL` on Render must match the Vercel address exactly (no trailing slash). |
| Website calls `localhost:4000` | `NEXT_PUBLIC_API_URL` missing on Vercel; set it and redeploy. |
| Backend can't connect to the database | Use the Supabase **Session pooler** string (the direct one is IPv6-only) and the right password. |
| Uploads fail | Check bucket name, S3 endpoint/region and keys from Supabase. |
| First request is slow | Render free plan was asleep. |

## Other hosting
Railway is also supported (Dockerfiles + `railway.json` in each app): see [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md).

## Local development

```bash
npm install
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
npm run migrate
npm run dev        # backend + frontend together
```
