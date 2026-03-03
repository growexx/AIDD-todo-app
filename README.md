# Todo App — NestJS + Next.js

Production-grade Todo application with a NestJS backend and Next.js frontend.

## Stack

- **Backend:** NestJS, MongoDB, Mongoose, JWT auth
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS
- **Auth:** JWT (login only; no registration UI)
- **Docs:** Swagger/OpenAPI at `/api/docs` (development only)

## Prerequisites

- **Node.js 22 LTS** — [https://nodejs.org](https://nodejs.org)
- **MongoDB** — running locally or remote URI in `.env`

## Environment setup

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your MONGODB_URI, JWT_SECRET, etc.
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL (default: http://localhost:5000)
```

## Installation

```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

## Development

```bash
# Terminal 1 — Backend (port 5000)
cd backend && npm run start:dev

# Terminal 2 — Frontend (port 3000)
cd frontend && npm run dev
```

- **Frontend:** http://localhost:3000  
- **Backend API:** http://localhost:5000  
- **Swagger:** http://localhost:5000/api/docs  

## Seeding the database

⚠️ **WARNING: Never run the seed script against a production database.** It deletes all users and todos and recreates demo data.

```bash
cd backend
npm run seed
```

After seeding, use the default credentials below to log in.

## Tests

```bash
cd backend
npm run test
```

## Default login credentials (after seed)

| Email              | Password  |
|--------------------|-----------|
| alice@todoapp.com  | Alice@123 |
| bob@todoapp.com    | Bob@123   |
| carol@todoapp.com  | Carol@123 |

Use these at http://localhost:3000 to sign in.
