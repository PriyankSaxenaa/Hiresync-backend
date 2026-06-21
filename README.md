# HireSync - Backend

A REST API built with Node.js, Express and MongoDB.

## Stack
- Node.js + Express
- MongoDB + Mongoose
- JWT for auth
- Nodemailer for emails
- express-validator for input validation

## Setup

```bash
npm install
cp .env.example .env
# fill in your values in .env
npm run dev
```

## API Endpoints

### Auth
| Method | Route | Description | Validated |
|--------|-------|-------------|-----------|
| POST | /api/auth/register | Register new user | ✅ name, email, password, role |
| POST | /api/auth/login | Login | ✅ email, password |
| POST | /api/auth/logout | Logout | — |

### Jobs
| Method | Route | Access | Description | Validated |
|--------|-------|--------|-------------|-----------|
| GET | /api/jobs | any logged-in user | Browse all jobs | — |
| GET | /api/jobs/:id | any logged-in user | Get single job | — |
| POST | /api/jobs | recruiter | Post a new job | ✅ title, company, description, location, skills, deadline |
| PUT | /api/jobs/:id | recruiter | Update own job | — |
| DELETE | /api/jobs/:id | recruiter | Delete own job | — |
| GET | /api/jobs/recruiter/my-jobs | recruiter | Get all jobs posted by me | — |

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

### Resume
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | /api/resume/upload | candidate | Upload PDF resume → auto-extract & save skills |

### Recommendations
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | /api/recommendations/jobs | candidate | Get jobs ranked by skill match score |
| GET | /api/recommendations/candidates/:jobId | recruiter | Get candidates ranked by skill match score for own job |

### College
| Method | Route | Access | Description | Validated |
|--------|-------|--------|-------------|-----------|
| POST | /api/college/register | tpo | Register your college (starts unverified, one per TPO) | ✅ name, address, website |
| GET | /api/college | admin | List all colleges | — |
| PUT | /api/college/:id/verify | admin | Verify a college so its TPO can operate | — |
| GET | /api/college/:id | any logged-in user | Get a college's details | — |

### TPO — Student Import
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | /api/tpo/import | tpo | Upload Excel/CSV (field `file`) → bulk create/link students, batch-email credentials in chunks of 50 |
| GET | /api/tpo/students | tpo | List all students of this TPO's college |
| GET | /api/tpo/students/:id | tpo | Get a single student's details |

### TPO — Student Groups
| Method | Route | Access | Description | Validated |
|--------|-------|--------|-------------|-----------|
| POST | /api/tpo/groups | tpo | Create a group with filters `{ minCgpa, branches[], skills[] }` → auto-populates matching students | ✅ name |
| GET | /api/tpo/groups | tpo | List all groups of this college | — |
| GET | /api/tpo/groups/:id | tpo | Get a group + its student list | — |
| PUT | /api/tpo/groups/:id | tpo | Update filters → re-runs the query and re-populates the group | — |

### TPO — Campus Drives
| Method | Route | Access | Description | Validated |
|--------|-------|--------|-------------|-----------|
| POST | /api/tpo/drives | tpo | Post a drive to a group → notifies every student in it (DB notification + Socket.IO). Requires a verified college | ✅ company, title, targetGroup, deadline |
| GET | /api/tpo/drives | tpo | List all drives of this college | — |
| GET | /api/tpo/drives/:id | tpo | Get a single drive's details | — |
| PUT | /api/tpo/drives/:id | tpo | Update drive details | — |
| PUT | /api/tpo/drives/:id/status | tpo | Manually set status (`upcoming` / `ongoing` / `closed`) | — |

### Campus (student side)
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | /api/campus/drives/:id/respond | candidate | Respond `interested` / `not_interested` to a drive — blocked once closed or past the deadline |

### Notifications
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | /api/notifications | any logged-in user | List my notifications (newest first) with an unread count |
| PUT | /api/notifications/read | any logged-in user | Mark all (or specific `ids`) as read |


## How Job Recommendations Work

1. Candidate's `skills` come from their profile (set manually or auto-filled by the Resume Parser).
2. `GET /api/recommendations/jobs` fetches every job and compares its `skillsRequired` against the candidate's `skills` (case-insensitive).
3. `matchScore` = `(matched skills / total required skills) * 100`, rounded to the nearest whole number.
4. Jobs are sorted highest match → lowest, and jobs with a 0% match are filtered out.
5. Each recommendation includes the `job`, its `matchScore`, the `matchedSkills`, and the `missingSkills` the candidate would need to be a full match.
6. If the candidate has no skills on their profile, the endpoint returns a `400` asking them to upload a resume or update their profile first.

## How Candidate Recommendations Work (Recruiter side)

1. `GET /api/recommendations/candidates/:jobId` is only available to the recruiter who owns that job (same ownership check used by `updateJob` / `deleteJob`).
2. Every candidate (`role: 'candidate'`) with at least one skill on their profile is compared against the job's `skillsRequired` using the same `matchScore` utility, just with the arguments reversed.
3. Candidates are sorted highest match → lowest, and candidates with a 0% match are filtered out.
4. Each recommendation includes the `candidate`, the `matchScore`, the `matchedSkills`, and the `missingSkills` they'd need to be a full match.
5. If the job has no `skillsRequired`, the endpoint returns a `400` since matching has nothing to compare against.

## Phase 3.1 / 3.2 — Setup Notes

### Folder changes
```
src/
├── controllers/
│   └── recommendation.controller.js   # new — getRecommendedJobs, getRecommendedCandidates
├── routes/
│   └── recommendation.routes.js       # new — GET /jobs, GET /candidates/:jobId
├── utils/
│   └── matchScore.js                  # new — skill match % calculator (shared both directions)
└── app.js                             # updated — mounts /api/recommendations
```

### Environment variables
None. Phase 3.1 and 3.2 reuse the existing DB connection and auth setup — no new variables were added to `.env` / `.env.example`.

### How to test
1. Log in as a candidate (`POST /api/auth/login`) so the `token` cookie is set.
2. Make sure the candidate has skills — either `PUT /api/jobs/profile` with a `skills` array, or `POST /api/resume/upload` to auto-extract them.
3. As a recruiter, create a few jobs (`POST /api/jobs`) with varying `skillsRequired`.
4. Call `GET /api/recommendations/jobs` as the candidate:
   - With no skills on the profile → expect `400` with a message to upload a resume / update profile.
   - With skills set → expect `200` with `recommendations` sorted by `matchScore` (highest first), each containing `matchedSkills` and `missingSkills`.
5. Call `GET /api/recommendations/candidates/:jobId` as the recruiter who owns that job:
   - As a different recruiter / without owning the job → expect `404`.
   - As the owning recruiter → expect `200` with `recommendations` of matching candidates, sorted by `matchScore`.

## How the Excel/CSV Student Import Works

1. A TPO must register and have a verified or unverified college on file first — `POST /api/college/register` links the college to the requesting TPO (`one college per TPO`).
2. `POST /api/tpo/import` accepts a single Excel (`.xlsx`/`.xls`) or CSV file under the `file` field, parsed in-memory with `xlsx` (no disk writes).
3. Each row is read tolerantly — header casing/spacing variants like `roll_no`, `Roll No`, `RollNo` are all accepted via a `pick()` helper.
4. Rows missing `name`, `email`, or `roll_no` are skipped and reported in `summary.errors` with the offending row number.
5. **Duplicate handling:**
   - Duplicate `roll_no` *within the same sheet* is skipped and reported.
   - An `email` that already exists in the database is **linked** to the importing college (not recreated) — their `rollNo`/`branch`/`cgpa` are updated and skills are merged, but no new account or email is sent.
   - A brand-new `email` gets a new candidate account with a random temporary password and is queued for a credentials email.
6. **Batch email sending:** all queued credential emails are sent through `sendBatchEmails(messages, chunkSize = 50)`, which chunks the list and fires each chunk with `Promise.allSettled` so one bad address never blocks the rest. The response includes a `{ total, sent, failed }` summary.
7. The endpoint responds with a `summary` (totalRows / created / linked / skipped / errors) and an `emails` summary in one shot.

## How Student Groups & Campus Drives Work

1. A TPO creates a `StudentGroup` with optional filters (`minCgpa`, `branches[]`, `skills[]`). The group is **auto-populated** at creation time by running those filters against the college's imported students — no manual student picking.
2. Updating a group's filters (`PUT /api/tpo/groups/:id`) re-runs the query and re-populates the `students` list from scratch.
3. A TPO posts a `CampusDrive` to one of their groups (`POST /api/tpo/drives`). The college must already be admin-verified, or the request is rejected.
4. On posting, every student currently in the target group gets:
   - a `Notification` document (visible via `GET /api/notifications`), and
   - a realtime `drive:new` event pushed over Socket.IO straight to their personal room (`user:<id>`), plus a broadcast to the whole college room (`college:<id>`).
5. Students connect to Socket.IO using the same JWT as the REST API (via the cookie or an explicit `auth.token`), and are auto-joined to their personal + college rooms on connect.
6. A student responds to a drive with `POST /api/campus/drives/:id/respond`. The response is **locked** once the drive's deadline has passed or its status was manually set to `closed` — both checks happen before the response is recorded.
7. Responses are upserted (one per student per drive), so a student can change their mind any time before the deadline.

## Validation Rules

### Register (`POST /api/auth/register`)
| Field | Rule |
|-------|------|
| name | Required, min 2 characters |
| email | Required, valid email format |
| password | Required, min 6 characters |
| role | Optional, must be `candidate`, `recruiter` or `tpo` |

### Login (`POST /api/auth/login`)
| Field | Rule |
|-------|------|
| email | Required, valid email format |
| password | Required |

### Create Job (`POST /api/jobs`)
| Field | Rule |
|-------|------|
| title | Required |
| company | Required |
| description | Required, min 20 characters |
| location | Required |
| skillsRequired | Required, must be array with at least 1 item |
| applicationDeadline | Required, valid ISO8601 date |

### Register College (`POST /api/college/register`)
| Field | Rule |
|-------|------|
| name | Required, min 2 characters |
| address | Optional |
| website | Optional, must be a valid URL if provided |

### Create Group (`POST /api/tpo/groups`)
| Field | Rule |
|-------|------|
| name | Required |
| filters | Optional, must be an object if provided |

### Create Drive (`POST /api/tpo/drives`)
| Field | Rule |
|-------|------|
| company | Required |
| title | Required |
| description | Optional |
| jd | Optional |
| targetGroup | Required, must be a valid group id |
| deadline | Required, valid ISO8601 date |

## Progress

### Phase 1 — Core + Error Handling ✅
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
### Phase 2.1 — Error Handling Infrastructure
- [x] `asyncHandler` — wraps all controllers, auto-catches async errors
- [x] `errorHandler` — global error handler (Mongoose, JWT, Multer, duplicates)
- [x] `validate` middleware — returns structured field-level errors

### Phase 2.2 — Input Validators ✅
- [x] `auth.validator.js` — register & login rules
- [x] `job.validator.js` — create job rules
- [x] Validators plugged into auth and job routes

### Phase 2.3 — Resume Parser
- [x] Cloudinary config
- [x] Multer config (PDF only, 5MB limit)
- [x] Skill extractor utility
- [x] Resume controller (upload → parse → extract skills)
- [x] Resume route (`POST /api/resume/upload`)

## Phase 3 — Recommendation / Matching System

### Phase 3.1 — Job Recommendations for Candidates ✅
- [x] `matchScore` utility — compares candidate skills vs a job's `skillsRequired`, returns match %, matched skills, missing skills
- [x] Recommendation controller (`getRecommendedJobs`) — scores & ranks all jobs for the logged-in candidate
- [x] Recommendation route (`GET /api/recommendations/jobs`) — candidate-only
- [x] Registered in `app.js` under its own `/api/recommendations` prefix (same pattern as `/api/resume`)

### Phase 3.2 — Candidate Recommendations for Recruiters ✅
- [x] Recruiter controller (`getRecommendedCandidates`) — reuses `matchScore` to rank candidates against a job's `skillsRequired`
- [x] Recommendation route (`GET /api/recommendations/candidates/:jobId`) — recruiter-only, scoped to jobs they own
- [x] No schema or env changes required — reuses existing `User.skills` and `Job.skillsRequired`

### PROJECT UPGRADE ++


### Phase 4:- Adding college and their TPO for posting Incampus Placements

## Phase 4.1 — Campus Placement Module ✅


- [x] `College` model — `name`, `address`, `website`, `isVerified`, `tpo` (owner ref)
- [x] `User` model extended — `tpo` role + on-campus fields (`college`, `rollNo`, `branch`, `cgpa`, `isImported`)
- [x] `authTPO` middleware — restricts TPO-only routes; `authUser` updated to recognize `tpo`
- [x] College registration (`POST /api/college/register`) — one college per TPO, starts unverified
- [x] Admin verification (`GET /api/college`, `PUT /api/college/:id/verify`) — admin-only, flips `isVerified`
- [x] Excel/CSV student import (`POST /api/tpo/import`) — `xlsx` parsing, tolerant headers, duplicate `roll_no`/`email` handling, temp passwords for new accounts
- [x] Batch email sending (`sendBatchEmails`) — credential emails sent in chunks of 50 via `Promise.allSettled`
- [x] `GET /api/tpo/students`, `GET /api/tpo/students/:id` — view imported students for the TPO's college

## Phase 4.2 — Campus Drives & Realtime Notifications ✅

- [x] `StudentGroup` model — `name`, `filters { minCgpa, branches[], skills[] }`, auto-populated `students[]`
- [x] Group auto-filter population — `buildMatchQuery()` runs on create *and* on every filter update
- [x] `CampusDrive` model — `company`, `title`, `description`, `jd`, `targetGroup`, `deadline`, `status`
- [x] `Notification` model + inbox (`GET /api/notifications`, `PUT /api/notifications/read`)
- [x] Socket.IO bootstrapped (`config/socket.js`) — JWT-authenticated handshake, personal (`user:<id>`) + college (`college:<id>`) rooms
- [x] Post drive to group (`POST /api/tpo/drives`) — requires a verified college, fans out a DB notification + `drive:new` socket event to every student in the target group
- [x] TPO drive management — list / get / update drive, manual status toggle (`upcoming` / `ongoing` / `closed`)
- [x] Student response with deadline lock (`POST /api/campus/drives/:id/respond`) — eligibility-checked against group membership, rejected once the deadline passes or status is `closed`, upserted so responses are editable until then
- [x] `server.js` now wraps Express in a raw `http` server so Socket.IO can share the same port
