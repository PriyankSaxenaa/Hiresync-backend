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

### Applications
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | /api/applications/apply/:jobId | candidate | Apply to a job |
| DELETE | /api/applications/withdraw/:applicationId | candidate | Withdraw application |
| GET | /api/applications/my-applications | candidate | Get all my applications |
| POST | /api/applications/save/:jobId | candidate | Save a job |
| GET | /api/applications/saved-jobs | candidate | Get all saved jobs |
| GET | /api/applications/job/:jobId/applicants | recruiter | View applicants for a job |
| PUT | /api/applications/:applicationId/status | recruiter | Accept or reject application |

### Admin
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | /api/admin/users | admin | Get all users |
| DELETE | /api/admin/users/:id | admin | Delete a user |
| GET | /api/admin/jobs | admin | Get all jobs |

## Progress
- [x] Project setup & DB connection
- [x] User model
- [x] Auth (register / login / logout)
- [x] Auth middleware (protect routes by role)
- [x] Job model + Job CRUD
- [x] Application model
- [x] Candidate profile (get / update)
- [x] Applications (apply, withdraw, save, recruiter views)
- [x] Email notifications
- [x] Admin panel
