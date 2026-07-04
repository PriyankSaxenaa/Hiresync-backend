# Architecture Guide

## Layering

```
routes/  →  validators/ (express-validator)  →  middlewares/ (auth, validate, cache)
         →  controllers/  →  models/ (Mongoose)  +  utils/  +  config/ (Redis, Socket.IO, Cloudinary)
```

`app.js` wires every route module under `/api/*` and finishes with a single `errorHandler`. Every controller is wrapped in `asyncHandler` at the route-declaration site, so a thrown/rejected promise anywhere always reaches the global handler instead of crashing the process.

## Auth Model

- JWT payload: `{ id, role, college }`, signed with `JWT_SECRET`, stored in an `httpOnly`, `secure`, `sameSite=none` cookie.
- Five middleware guards in `auth.middleware.js` (`authCandidate`, `authRecruiter`, `authAdmin`, `authTPO`, `authUser`) all share a `verifyUserExists()` check — this closes the gap where a deleted account's token would otherwise keep authenticating until it naturally expired.
- Socket.IO reuses the exact same JWT — `config/socket.js` extracts it from the handshake `auth.token` or, failing that, parses it out of the cookie header — so there's no parallel auth system to keep in sync.

## Caching Strategy

`middlewares/cache.middleware.js` implements a transparent read-through cache:

1. `isRedisReady()` gate — if Redis isn't connected, the middleware is a no-op `next()`. The route behaves identically with or without Redis.
2. On a cache **miss**, `res.json` is monkey-patched so whatever the controller ultimately sends is also written to Redis with a TTL — the controller itself has zero awareness that caching exists.
3. Keys are centralised in `utils/cacheKeys.js` so the read side and the write side (invalidation) can never disagree on key shape.

**Invalidation granularity** is deliberately narrow:

| Write event | What gets busted |
|---|---|
| Job created/updated/deleted | That job's `jobs:item:<id>` + every `jobs:list:*` + every `jobs:recommended:*` |
| New/updated campus drive | Every cached feed for that college: `campus:drives:<collegeId>:*` |
| One student's placement group changes | Only that student's feed: `campus:drives:<collegeId>:<studentId>` |

That last one matters: assigning or moving a single student never invalidates the whole college's cached drive feeds — only the one student whose eligibility actually changed.

## Drive Targeting Model

`CampusDrive.targetType` is one of `studentGroup | placementGroup | all`. `utils/driveAudience.js` is the **single source of truth** consulted by every consumer of this concept:

- `getAudienceStudentIds(collegeId, drive)` — resolves the drive's audience to a list of user IDs, used when sending creation notifications and building the TPO report.
- `isCandidateInAudience(candidate, drive)` — used by eligibility checks on the student-facing side.
- `buildAudienceFilter(placementGroupId)` — a Mongo `$or` filter fragment used directly by the campus feed query.

`StudentGroup` (filter-based: min CGPA, branches, skills — auto-populated) was the original targeting mechanism. `PlacementGroup` (manually managed, one group per student, tracked via `User.placementGroup`) was added later for TPOs who wanted precise control. Rather than migrating existing drives, both `targetType`s remain valid simultaneously — old drives keep resolving through `StudentGroup`, new ones can use either.

## Drive Status

`CampusDrive.status` is TPO-set (`upcoming` / `ongoing` / `closed`) but can go stale — nobody flips it the moment a deadline passes. `utils/driveStatus.js#effectiveStatus()` recomputes the *true* status on every read: if `deadline` is in the past, the drive is `closed` no matter what's stored. This removes the need for a cron job to sweep expired drives.

## Notification Pipeline

Every real-time event follows the same two-step pattern in the controller:

1. `notificationModel.create({...})` — persists the notification so it survives even if no client is connected.
2. `emitToUser(...)` / `emitToCollege(...)` — pushes it live over Socket.IO if the recipient is connected right now.

This means the notification inbox (`GET /api/notifications`) and the real-time socket stream are always consistent with each other — there's exactly one code path that decides "this event happened," and both delivery mechanisms hang off it.

## Bulk Student Import

`tpo.controller.js#importStudents` parses an uploaded sheet with `xlsx`, tolerant of header casing (`Roll No` / `rollNo` / `ROLL_NO` all resolve via a `pick()` helper), and for each row:

- Skips rows missing `name`, `email`, or `rollNo`, recording the reason and the human-readable row number.
- Dedupes by roll number **within the sheet** before ever hitting the database.
- If the email already belongs to an existing user, **links** that account to the college instead of creating a duplicate, merging skill sets.
- Otherwise creates a new account with a random temp password and queues a credentials email.

Credential emails are sent via `sendBatchEmails()`, which chunks the queue (default 50 at a time) and uses `Promise.allSettled` so a single bad address or transient email-provider error never blocks the rest of the batch — the response reports exact `sent` / `failed` counts.

## Resume Parsing Pipeline

`resume.controller.js#uploadResume`:

1. Multer buffers the PDF in memory (never touches disk).
2. The buffer streams straight to Cloudinary (`resource_type: raw`) — no temp file, no cleanup step.
3. `pdf-parse` extracts text from the same buffer.
4. `utils/skillExtractor.js` regex-matches the text against a curated 150+ term skill list using negative lookahead/lookbehind word boundaries, so `"java"` doesn't spuriously match inside `"javascript"`.
5. Matched skills are `$addToSet`-merged into the candidate's profile — re-uploading a resume never produces duplicate skills.

## Skill Matching Algorithm

`utils/matchScore.js` is intentionally tiny and framework-free:

```js
score = round( |matchedSkills| / |jobSkills| * 100 )
```

Both sides lowercase their skill lists before comparing, so casing never causes a false miss. It's consumed identically by:

- `recommendation.controller.js#getRecommendedJobs` — every job scored against a candidate's skills, filtered to `score > 0`, sorted descending.
- `recommendation.controller.js#getRecommendedCandidates` — every candidate scored against a job's required skills, same filter/sort.

One function, one behavior guarantee, two consumers that can never drift apart.