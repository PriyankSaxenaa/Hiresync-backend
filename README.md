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

## API Endpoints

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |

### Jobs
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | /api/jobs | any logged-in user | Browse all jobs (filter by keyword, location, skills) |
| GET | /api/jobs/:id | any logged-in user | Get single job |
| POST | /api/jobs | recruiter | Post a new job |
| PUT | /api/jobs/:id | recruiter | Update own job |
| DELETE | /api/jobs/:id | recruiter | Delete own job |
| GET | /api/jobs/recruiter/my-jobs | recruiter | Get all jobs posted by me |

### Candidate Profile
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | /api/jobs/profile | candidate | Get my profile |
| PUT | /api/jobs/profile | candidate | Update my profile |

## Progress
- [x] Project setup & DB connection
- [x] User model
- [x] Auth (register / login / logout)
- [x] Auth middleware (protect routes by role)
- [x] Job model + Job CRUD
- [x] Application model
- [x] Candidate profile (get / update)
- [ ] Applications (apply, withdraw, save)
- [ ] Admin panel
