# OFSMS

Monorepo with three parts:

| Part | Path | Stack |
|---|---|---|
| Backend API | `apps/backend` | Node.js + Express |
| Frontend website | `apps/frontend` | Next.js |
| Database | managed by Railway | PostgreSQL |

## Deploy on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new)

This runs everything in one Railway project: **PostgreSQL + backend + frontend**.

> **One-click setup:** Railway's button deploys a *template*. Create it once in
> Railway (Project → **Settings → Generate Template from Project**, or
> <https://railway.com/workspace/templates> → **New Template**), then replace the
> button link above with `https://railway.com/new/template/<YOUR_TEMPLATE_CODE>`.

Template services to add:

| Service | Source | Root directory | Port |
|---|---|---|---|
| `Postgres` | Railway PostgreSQL | – | – |
| `backend` | this GitHub repo | `apps/backend` | 4000 |
| `frontend` | this GitHub repo | `apps/frontend` | 3000 |

Variables (set on the template so they are prompted on deploy):

**backend**
```
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
PORT=4000
JWT_SECRET=${{secret(64)}}
JWT_REFRESH_SECRET=${{secret(64)}}
JWT_SPONSOR_SECRET=${{secret(64)}}
JWT_EXPIRES_IN=30m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
PUBLIC_API_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
ADMIN_EMAIL=            # first General Manager account (prompt)
ADMIN_PASSWORD=         # at least 10 characters (prompt)
ADMIN_NAME=مدير النظام
UPLOADS_DIR=/data/uploads
STORAGE_DRIVER=local
```
Add a Volume mounted at `/data` on the backend so uploads survive redeploys.

**frontend**
```
NEXT_PUBLIC_API_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}/api
```

Migrations and first-admin creation run automatically before each backend deploy.
Full step-by-step guide and troubleshooting: [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md).

## Local development

```bash
npm install
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env
npm run migrate
npm run dev        # backend + frontend together
```
