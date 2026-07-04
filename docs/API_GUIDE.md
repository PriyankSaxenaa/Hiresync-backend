# API Guide

Base URL: `/api`
Auth: JWT in an `httpOnly` cookie named `token`, set on login/register. All protected routes read this cookie — no `Authorization` header needed.

---

## Auth — `/api/auth`

| Method | Route | Access | Description | Validated |
|---|---|---|---|---|
| POST | `/send-otp` | public | Sends a 6-digit OTP to an email not yet registered. 60s resend cooldown. | ✅ email |
| POST | `/verify-otp` | public | Verifies the OTP; opens a 15-minute window to complete registration. | ✅ email, otp |
| POST | `/register` | public (requires verified OTP) | Creates the account, sets the auth cookie. | ✅ name, email, password, role |
| POST | `/login` | public | Authenticates, sets the auth cookie. | ✅ email, password |
| POST | `/logout` | any | Clears the auth cookie. | — |

## Jobs — `/api/jobs`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/profile` | candidate | Get own candidate profile |
| PUT | `/profile` | candidate | Update own candidate profile |
| GET | `/recommended` | candidate | Skill-matched job recommendations. **Cached 120s/user** |
| GET | `/` | any logged-in user | Browse/filter jobs. **Cached 60s** per filter combo |
| GET | `/:id` | any logged-in user | Single job detail. **Cached 60s** |
| POST | `/` | recruiter | Create a job — invalidates list/recommendation caches |
| PUT | `/:id` | recruiter | Update own job — invalidates that job's cache |
| DELETE | `/:id` | recruiter | Delete own job — invalidates that job's cache |
| GET | `/recruiter/my-jobs` | recruiter | Jobs posted by the current recruiter |

## Applications — `/api/applications`

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/apply/:jobId` | candidate | Apply to a job — notifies the recruiter in real time |
| DELETE | `/withdraw/:applicationId` | candidate | Withdraw an application |
| GET | `/my-applications` | candidate | List own applications |
| POST | `/save/:jobId` | candidate | Bookmark a job |
| GET | `/saved-jobs` | candidate | List bookmarked jobs |
| GET | `/job/:jobId/applicants` | recruiter | List applicants for a job |
| PUT | `/:applicationId/status` | recruiter | Accept/reject — notifies the candidate in real time |

## Resume — `/api/resume`

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/upload` | candidate | Upload a PDF resume (`multipart/form-data`, field `resume`). Stored on Cloudinary, text extracted, skills auto-merged into the profile. |

## Recommendations — `/api/recommendations`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/jobs` | candidate | Same engine as `/api/jobs/recommended` |
| GET | `/candidates/:jobId` | recruiter | Ranked candidate shortlist for a job the recruiter owns |

## Admin — `/api/admin`

| Method | Route | Description |
|---|---|---|
| GET | `/users` | List all users |
| DELETE | `/users/:id` | Delete a user |
| GET | `/jobs` | List all jobs platform-wide |

## Analytics — `/api/analytics`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/dashboard` | recruiter | Hiring funnel: jobs posted, application counts by status, acceptance rate, per-job breakdown |

## Colleges — `/api/college`

| Method | Route | Access | Description |
|---|---|---|---|
| POST | `/register` | tpo | Register a college (starts unverified) |
| GET | `/` | admin | List all colleges |
| PUT | `/:id/verify` | admin | Verify a college — unblocks all TPO actions |
| GET | `/:id` | any logged-in user | College detail |

## TPO — `/api/tpo`

*Every route below requires a verified TPO (`resolveCollege` guard).*

| Method | Route | Description |
|---|---|---|
| POST | `/import` | Bulk import students from an Excel/CSV sheet (field `file`) |
| GET | `/students` | List imported students |
| GET | `/students/:id` | Student detail |
| POST | `/groups` | Create a filter-based `StudentGroup` |
| GET | `/groups` | List student groups |
| GET | `/groups/:id` | Group detail |
| PUT | `/groups/:id` | Update group filters (re-populates membership) |
| POST | `/drives` | Create a campus drive — notifies the target audience in real time |
| GET | `/drives` | List drives for this college |
| GET | `/drives/:id` | Drive detail |
| PUT | `/drives/:id` | Update a drive |
| PUT | `/drives/:id/status` | Manually override drive status |
| GET | `/drives/:id/report` | Download a PDF response report |
| GET | `/analytics` | Placement analytics dashboard |

## Campus — `/api/campus`

*Every route below requires a logged-in candidate.*

| Method | Route | Description |
|---|---|---|
| GET | `/drives` | Feed of drives this candidate is eligible for. **Cached 60s** per college+user |
| GET | `/drives/:id` | Drive detail |
| POST | `/drives/:id/respond` | Respond `interested` / `not_interested` (upserted, one per candidate per drive) |
| PUT | `/profile` | Update resume/skills (other imported fields are locked) |

## Placement Groups — `/api/placement-groups`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/my-group` | candidate | View own placement group |
| POST | `/` | tpo | Create a group |
| GET | `/` | tpo | List groups |
| GET | `/:id` | tpo | Group detail |
| PUT | `/:id` | tpo | Update a group |
| DELETE | `/:id` | tpo | Delete a group |
| POST | `/:id/students` | tpo | Assign one student |
| DELETE | `/:id/students/:studentId` | tpo | Remove one student |
| POST | `/:id/students/bulk` | tpo | Bulk assign |
| POST | `/students/bulk-remove` | tpo | Bulk remove |
| POST | `/move` | tpo | Move a student between groups |

## Notifications — `/api/notifications`

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/` | any logged-in user | Fetch the notification inbox |
| PUT | `/read` | any logged-in user | Mark notifications as read |

---

## Realtime Events (Socket.IO)

Connect with the same JWT (via `auth: { token }` handshake or the existing cookie). Sockets auto-join `user:<id>` and, when applicable, `college:<id>`.

| Event | Room | Fired when |
|---|---|---|
| `application:new` | `user:<recruiterId>` | A candidate applies to a job |
| `application:status` | `user:<candidateId>` | A recruiter accepts/rejects an application |
| `drive:new` | `user:<studentId>` and `college:<collegeId>` | A TPO posts a new campus drive |
| `drive:response:confirmed` | `user:<candidateId>` | A candidate's drive response is recorded |

Every event above is paired with a persisted `Notification` document, so nothing is lost if the client wasn't connected when it fired.