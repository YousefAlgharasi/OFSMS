# OFSMS backend image (Railway, or any Docker host).
# Includes Chromium + Arabic fonts because PDF reports are rendered with puppeteer-core.
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-noto-core fonts-hosny-amiri ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && node -e "require('express'); require('pg'); require('puppeteer-core')"

COPY . .

# Railway injects PORT; the app reads process.env.PORT (default 4000)
EXPOSE 4000
# Migrations + first-admin creation, then the API (works on Render, which has no pre-deploy step on free plans)
CMD ["npm", "run", "start:prod"]
