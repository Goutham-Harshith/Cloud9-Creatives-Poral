# Cloud9 Creatives Backend

NestJS backend for the Cloud9 Creatives portal.

## First API

`POST /api/auth/login`

```json
{
  "email": "gouthamharshith115@gmail.com",
  "password": "test@123"
}
```

The current first-pass backend uses a seeded in-memory admin user so the Angular login page can call a real API immediately. Database-backed users will replace this once PostgreSQL/Prisma is added.

## Run Locally

```bash
npm install
npm run start:dev
```

The server runs on `http://localhost:3000` by default.
