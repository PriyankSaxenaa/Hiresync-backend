# Job Portal Backend

A REST API built with Node.js, Express and MongoDB.

## Stack
- Node.js + Express
- MongoDB + Mongoose
- JWT for auth
- Nodemailer for emails

## Setup

```bash
npm install
cp .env.example .env
# fill in your values in .env
npm run dev
```

## Auth Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |

## Progress
- [x] Project setup & DB connection
- [x] User model
- [x] Auth (register / login / logout)
- [ ] Auth middleware (protect routes)
- [ ] Job CRUD
- [ ] Applications
- [ ] Admin panel
