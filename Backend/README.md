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

## Database Login Setup

The login API now reads users from PostgreSQL through Prisma.

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL:

```bash
docker compose up -d
```

3. Create the database tables:

```bash
npm run prisma:migrate -- --name init
```

4. Seed the first admin user:

```bash
npm run prisma:seed
```

Seeded login:

```txt
Email: gouthamharshith115@gmail.com
Password: test@123
```
