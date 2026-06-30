# HireSync - Backend

A REST API built with Node.js, Express and MongoDB.

It covers two worlds in one platform:

- **Off-campus** — recruiters post jobs, candidates self-register, upload resumes (skills auto-extracted), get match-scored recommendations, apply, and get accept/reject notifications.
- **On-campus** — colleges register, an admin verifies them, a TPO imports students from Excel/CSV, builds filtered student groups, posts campus drives to a group, students respond before a deadline, and the TPO downloads a PDF report and views placement analytics.

## Stack
- Node.js + Express
- MongoDB + Mongoose
- JWT for auth
- Nodemailer for emails
- express-validator for input validation
- Redis (ioredis) for optional caching
- Socket.IO for realtime notifications
- pdfkit for PDF reports
- Cloudinary + Multer (resume upload), pdf-parse (skill extraction)
- xlsx (Excel/CSV student import)

## Setup

```bash
npm install
cp .env.example .env
# fill in your values in .env
npm run dev
```

### Environment variables
| Var | Required | Notes |
|-----|----------|-------|
| `PORT` | no | defaults to 3000 |
| `MONGO_URI` | **yes** | MongoDB connection string |
| `JWT_SECRET` | **yes** | signs the auth cookie |
| `CLIENT_URL` | no | Socket.IO CORS origin (defaults to `*`) |
| `REDIS_URL` | no | if Redis is down, caching simply no-ops |
| `EMAIL_SERVICE` / `EMAIL_USER` / `EMAIL_PASS` | for emails | Nodemailer credentials |
| `CLOUDINARY_*` | for resume upload | Cloudinary credentials |

## Roles
| Role | Can do |
|------|--------|
| `admin` | verify colleges, manage users/jobs |
| `tpo` | belongs to one college: import students, build groups, run drives |
| `recruiter` | post off-campus jobs, manage applications |
| `candidate` | imported (on-campus) or self-registered (off-campus) |

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
| GET | /api/jobs | any logged-in user | Browse all jobs. **Cached 60s** per filter/page combo | — |
| GET | /api/jobs/:id | any logged-in user | Get single job. **Cached 60s** | — |
| GET | /api/jobs/recommended | candidate | Jobs ranked by skill match, spec-aligned alias of `/api/recommendations/jobs`. **Cached 120s** per user | — |
| POST | /api/jobs | recruiter | Post a new job — invalidates the job-list & recommendation caches | ✅ title, company, description, location, skills, deadline |
| PUT | /api/jobs/:id | recruiter | Update own job — invalidates that job's cache | — |
| DELETE | /api/jobs/:id | recruiter | Delete own job — invalidates that job's cache | — |
| GET | /api/jobs/recruiter/my-jobs | recruiter | Get all jobs posted by me | — |

### Candidate Profile
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | /api/jobs/profile | candidate | Get my profile |
| PUT | /api/jobs/profile | candidate | Update my profile |

### Applications
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | /api/applications/apply/:jobId | candidate | Apply to a job — notifies the recruiter |
| DELETE | /api/applications/withdraw/:applicationId | candidate | Withdraw application |
| GET | /api/applications/my-applications | candidate | Get all my applications |
| POST | /api/applications/save/:jobId | candidate | Save a job |
| GET | /api/applications/saved-jobs | candidate | Get all saved jobs |
| GET | /api/applications/job/:jobId/applicants | recruiter | View applicants for a job |
| PUT | /api/applications/:applicationId/status | recruiter | Accept or reject application — notifies the candidate via email + Socket.IO |

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
| GET | /api/recommendations/jobs | candidate | Get jobs ranked by skill match score (legacy route, kept mounted; same data as `/api/jobs/recommended`) |
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

Sheet columns: `name | email | roll_no | branch | cgpa | skills` (`skills` comma-separated).

### TPO — Student Groups
| Method | Route | Access | Description | Validated |
|--------|-------|--------|-------------|-----------|
| POST | /api/tpo/groups | tpo | Create a group with filters `{ minCgpa, branches[], skills[] }` → auto-populates matching students | ✅ name |
| GET | /api/tpo/groups | tpo | List all groups of this college | — |
| GET | /api/tpo/groups/:id | tpo | Get a group + its student list | — |
| PUT | /api/tpo/groups/:id | tpo | Update filters → re-runs the query and re-populates the group | — |

Filter semantics: `cgpa ≥ minCgpa`, `branch ∈ branches` (case-insensitive), student has **all** listed `skills`.

### TPO — Campus Drives
| Method | Route | Access | Description | Validated |
|--------|-------|--------|-------------|-----------|
| POST | /api/tpo/drives | tpo | Post a drive to a group → notifies every student in it (DB notification + Socket.IO). Requires a verified college | ✅ company, title, targetGroup, deadline |
| GET | /api/tpo/drives | tpo | List all drives of this college — `status` is auto-managed (always `closed` past the deadline) | — |
| GET | /api/tpo/drives/:id | tpo | Get a drive's details + a response summary (interested / not interested / no response) | — |
| PUT | /api/tpo/drives/:id | tpo | Update drive details | — |
| PUT | /api/tpo/drives/:id/status | tpo | Manually set status (`upcoming` / `ongoing` / `closed`) before the deadline | — |
| GET | /api/tpo/drives/:id/report | tpo | Download a PDF report of every targeted student's response |
| GET | /api/tpo/analytics | tpo | College placement stats: drives, responses, interested %, branch breakdown, top skills |

### Campus (student side)
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | /api/campus/drives | candidate | Feed of drives for groups this student belongs to, eligibility-filtered. **Cached 60s** per college+user |
| GET | /api/campus/drives/:id | candidate | Single drive's details (eligibility-checked) + my own response |
| POST | /api/campus/drives/:id/respond | candidate | Respond `interested` / `not_interested` — blocked once closed or past the deadline |
| PUT | /api/campus/profile | candidate | Update resume + skills only (name/email/rollNo/branch/cgpa stay locked); flips `profileComplete` once both are set |

### Notifications
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | /api/notifications | any logged-in user | List my notifications (newest first) with an unread count |
| PUT | /api/notifications/read | any logged-in user | Mark all (or specific `ids`) as read |

### Analytics
| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | /api/analytics/dashboard | recruiter | Hiring funnel: jobs posted, total applications, accepted/rejected/pending breakdown |
| GET | /api/tpo/analytics | tpo | College placement stats: drives, responses, interested %, branch breakdown, top skills |

## How Job Recommendations Work

1. Candidate's `skills` come from their profile (set manually or auto-filled by the Resume Parser).
2. `GET /api/jobs/recommended` (and the legacy `GET /api/recommendations/jobs`) fetches every job and compares its `skillsRequired` against the candidate's `skills` (case-insensitive).
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

## How the Excel/CSV Student Import Works

1. A TPO must register and have a verified or unverified college on file first — `POST /api/college/register` links the college to the requesting TPO (one college per TPO).
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

## Drive Status, Profile Completion, PDF Reports & Caching

**Auto-managed drive status** — `utils/driveStatus.js` is the single source of truth:
- `effectiveStatus(drive)`: once `deadline` has passed, a drive always reads as `closed`, no matter what's stored. Before the deadline, the TPO's manually-set status (`upcoming` / `ongoing`) is trusted.
- `isDriveOpen(drive)`: used to gate `POST /api/campus/drives/:id/respond` — the same rule the feed displays is the rule that locks responses.

**Profile completion flag** — `PUT /api/campus/profile` recomputes `user.profileComplete` after every update: `true` once both `resumeUrl` and at least one skill are present, `false` otherwise.

**Campus drive feed** — `GET /api/campus/drives` returns only drives whose `targetGroup` the student actually belongs to (eligibility-filtered), each annotated with the student's own response if they've made one.

**PDF report** — `GET /api/tpo/drives/:id/report` streams an A4 landscape PDF (built with `pdfkit`, no temp files) listing every targeted student's name / roll no / branch / CGPA / skills / response, with automatic pagination.

**Redis caching** — `config/redis.js` connects lazily and never blocks the app: if Redis is down, `middlewares/cache.middleware.js` just passes every request straight through (the API is identical with or without it). Cached routes:

| Route | TTL | Invalidated on |
|-------|-----|-----------------|
| `GET /api/jobs` | 60s | any job create/update/delete |
| `GET /api/jobs/:id` | 60s | that job's update/delete |
| `GET /api/jobs/recommended` | 120s | any job create (broad invalidation) |
| `GET /api/campus/drives` | 60s, per college+user | a drive being posted/updated/status-changed for that college |

A `X-Cache: HIT`/`MISS` response header is set on every cached route so you can see it working. If Redis is unavailable, every request is a cache miss and the API behaves normally.

## Real-time (Socket.IO)

Connect with the JWT cookie, or `io(url, { auth: { token } })`. Each socket joins a personal room `user:<id>` and (for on-campus users) `college:<collegeId>`.

| Event | To | When |
|-------|----|------|
| `drive:new` | group students + college room | a drive is posted |
| `drive:response:confirmed` | the responding student | response recorded |
| `application:new` | the recruiter | a candidate applies |
| `application:status` | the candidate | recruiter accepts/rejects |

Every realtime event is backed by a persisted `Notification` document, so nothing is lost if the client wasn't connected — `GET /api/notifications` always has the full history.

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

## Project Structure
```
src/
├── app.js                 # express app + route mounting
├── config/                # cloudinary, multer (pdf + excel), redis, socket
├── controllers/           # auth, job, application, recommendation, resume, candidate,
│                          # admin, college, tpo, campus, notification, analytics
├── db/db.js               # mongoose connection
├── middlewares/           # auth (incl. authTPO), cache, validate, errorHandler
├── models/                # user, job, application, college, studentGroup,
│                          # campusDrive, driveResponse, notification
├── routes/                # one router per domain
├── utils/                 # matchScore, skillExtractor, sendEmail (+batch),
│                          # cacheKeys, generatePDF, driveStatus
└── validators/            # auth, job, college, drive
server.js                  # http server + Socket.IO + Redis bootstrap
```

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

### Phase 2.1 — Error Handling Infrastructure ✅
- [x] `asyncHandler` — wraps all controllers, auto-catches async errors
- [x] `errorHandler` — global error handler (Mongoose, JWT, Multer, duplicates)
- [x] `validate` middleware — returns structured field-level errors

### Phase 2.2 — Input Validators ✅
- [x] `auth.validator.js` — register & login rules
- [x] `job.validator.js` — create job rules
- [x] Validators plugged into auth and job routes

### Phase 2.3 — Resume Parser ✅
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

## Phase 4 — Campus Placement Module

### Phase 4.1 — College & TPO Onboarding ✅
- [x] `College` model — `name`, `address`, `website`, `isVerified`, `tpo` (owner ref)
- [x] `User` model extended — `tpo` role + on-campus fields (`college`, `rollNo`, `branch`, `cgpa`, `isImported`)
- [x] `authTPO` middleware — restricts TPO-only routes; `authUser` updated to recognize `tpo`
- [x] College registration (`POST /api/college/register`) — one college per TPO, starts unverified
- [x] Admin verification (`GET /api/college`, `PUT /api/college/:id/verify`) — admin-only, flips `isVerified`
- [x] Excel/CSV student import (`POST /api/tpo/import`) — `xlsx` parsing, tolerant headers, duplicate `roll_no`/`email` handling, temp passwords for new accounts
- [x] Batch email sending (`sendBatchEmails`) — credential emails sent in chunks of 50 via `Promise.allSettled`
- [x] `GET /api/tpo/students`, `GET /api/tpo/students/:id` — view imported students for the TPO's college

### Phase 4.2 — Campus Drives & Realtime Notifications ✅
- [x] `StudentGroup` model — `name`, `filters { minCgpa, branches[], skills[] }`, auto-populated `students[]`
- [x] Group auto-filter population — `buildMatchQuery()` runs on create *and* on every filter update
- [x] `CampusDrive` model — `company`, `title`, `description`, `jd`, `targetGroup`, `deadline`, `status`
- [x] `Notification` model + inbox (`GET /api/notifications`, `PUT /api/notifications/read`)
- [x] Socket.IO bootstrapped (`config/socket.js`) — JWT-authenticated handshake, personal (`user:<id>`) + college (`college:<id>`) rooms
- [x] Post drive to group (`POST /api/tpo/drives`) — requires a verified college, fans out a DB notification + `drive:new` socket event to every student in the target group
- [x] TPO drive management — list / get / update drive, manual status toggle (`upcoming` / `ongoing` / `closed`)
- [x] Student response with deadline lock (`POST /api/campus/drives/:id/respond`) — eligibility-checked against group membership, rejected once the deadline passes or status is `closed`, upserted so responses are editable until then
- [x] `server.js` now wraps Express in a raw `http` server so Socket.IO can share the same port

### Phase 4.3 — Status, PDFs, Profiles & Caching ✅
- [x] Drive status auto-management — `utils/driveStatus.js` (`effectiveStatus`, `isDriveOpen`), used consistently by the TPO drive views, the student feed, and the response lock
- [x] `GET /api/tpo/drives/:id` now returns a response summary (interested / not interested / no response)
- [x] PDF drive report — `utils/generatePDF.js` (`pdfkit`) streamed via `GET /api/tpo/drives/:id/report`
- [x] `profileComplete` flag on `User` — recomputed on every `PUT /api/campus/profile`
- [x] Campus drive feed for students — `GET /api/campus/drives` / `GET /api/campus/drives/:id`, eligibility-filtered to the student's groups, includes their own response
- [x] Redis caching — `config/redis.js` (optional, never blocks startup), `middlewares/cache.middleware.js` (transparent read-through, `X-Cache` header), `utils/cacheKeys.js` (key builders + write-side invalidators)
- [x] Caching wired into: job list, job-by-id, recommended jobs, campus drive feed — with invalidation on every relevant write
- [x] Fixed a leftover stub in `getJobById` (`GET /api/jobs/:id` previously always threw) so the now-cached route actually works
- [x] `server.js` connects Redis at boot alongside Mongo and Socket.IO

### Phase 4.4 — Full Socket.IO ✅
- [x] **Drive announcements** (`drive:new`) — carried over from Phase 4.2, still fires on `POST /api/tpo/drives`
- [x] **Response confirmations** (`drive:response:confirmed`) — `POST /api/campus/drives/:id/respond` now also creates a `Notification` and pings the student in realtime once their response is saved
- [x] **Off-campus apply notifications** (`application:new`) — `POST /api/applications/apply/:jobId` notifies + pings the recruiter who owns the job
- [x] **Off-campus status notifications** (`application:status`) — `PUT /api/applications/:applicationId/status` notifies + pings the candidate when accepted/rejected
- [x] Every realtime event is backed by a persisted `Notification` document, so nothing is lost if the client wasn't connected — `GET /api/notifications` always has the full history

A note on scope: the codebase doesn't implement a distinct "shortlist" status or event separate from the existing accept/reject flow — `application:status` already covers the off-campus accepted/rejected case end to end, so that's what's wired here rather than inventing a parallel mechanism.

## Phase 5 — Analytics, Spec Alignment & Final Polish ✅
- [x] Recruiter hiring-funnel analytics (`GET /api/analytics/dashboard`) — jobs posted, total applications, accepted/rejected/pending breakdown, recruiter-scoped
- [x] TPO placement analytics (`GET /api/tpo/analytics`) — drive count, response totals, interested %, branch-wise breakdown, top requested skills, college-scoped
- [x] `GET /api/jobs/recommended` added as the spec-aligned alias for candidate job recommendations — same controller/logic as `GET /api/recommendations/jobs`, both routes kept mounted so neither integration breaks
- [x] Fixed `/api/admin/*` — it was accidentally wired to duplicate the job routes instead of the admin controller; now correctly serves `GET /api/admin/users`, `DELETE /api/admin/users/:id`, `GET /api/admin/jobs`
- [x] Environment variable table and role matrix documented for first-time setup
- [x] Project structure and full route map consolidated into this README as the final, authoritative reference

### Two pre-existing bugs fixed along the way
Both sat directly in the path of newly-built features, so they were fixed rather than worked around:
1. `GET /api/jobs/:id` was a stub that always threw — fixed when Phase 4.3 added caching to it.
2. `/api/admin/*` was accidentally wired to duplicate the job routes instead of the admin controller — fixed when Phase 5 wired up the admin overview.

## Notes
- A full live run needs MongoDB (required) plus, optionally, Redis, SMTP, and Cloudinary credentials.
- The on-campus build added `ioredis`, `socket.io`, `xlsx`, `pdfkit` on top of the original off-campus dependency set.