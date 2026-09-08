# RAG YouTube + PDF + IdentityServer

This workspace contains a full-stack starter for a RAG system with:

- Angular frontend
- ASP.NET Core backend
- Duende IdentityServer + ASP.NET Core Identity
- PostgreSQL for relational data
- Weaviate for vector search
- PDF OCR/data ingestion and YouTube source management skeletons

## Stack

- Frontend: Angular 18+
- Backend: ASP.NET Core Web API (net8.0)
- Auth: Duende IdentityServer + ASP.NET Core Identity
- Database: PostgreSQL
- Vector DB: Weaviate

## Run services

```bash
docker compose up -d
```

## Backend

```bash
cd Rag.Api
dotnet restore
dotnet ef database update
# or just run the app

dotnet run
```

## Frontend

```bash
cd frontend
npm install
npm run start
```

## Default admin account

- Email: admin@ragyt.local
- Password: Admin123!

## Default user account

- Email: user@ragyt.local
- Password: User123!

## API example

- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/admin-dashboard
- GET /api/auth/user-dashboard
- GET /api/sources

## Notes

This starter is designed for local development and extension. For production, add HTTPS certs, secret management, a real OCR provider, and actual YouTube MCP integration.
