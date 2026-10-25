# Roadmap

v1 (this repo, `web/`) is a frontend-only app. Progress, decision timelines and notes live in the browser's localStorage behind a small repository interface (`web/src/repo/storage.ts`). The pieces below are planned, not built.

## 0. Next up (in this order)

Each step builds on the one before it, so case studies come last.

**Shifts (boss fights), first version built:** after a milestone episode, an unscripted level opens on the story path. It has a short visual-novel briefing, a starting design, every block earned so far, and 3–4 waves of traffic (one of them chaos) that run back to back. Hints open only after the first failed run. Scoring: ★ survive, ★ at or under par blocks, ★ worst p99 under target. Content lives in `web/src/content/shifts/`; there are two so far (Monday Rush after replication, Front Page after the CDN).

1. **Story page redesign:** each chapter is a startup growth arc (100 → 1M users). Lessons become episodes, listed next to a sticky detail panel that shows the hook, the blocks it unlocks, its sections and a Start button.
2. **Custom named services (done):** any block can be renamed from the Inspector (`DNode.label`). A generic `service` block has a machine size (`DNode.tier`: Small 500, Medium 1,000, Large 4,000 units/s). The "Services and machine size" episode (after stateless) unlocks it and teaches sizing up vs scaling out. Lessons check names and sizes with the `configure` step.
3. **API design, in two parts:**
   - A short chapter on REST resources, idempotency, pagination, versioning and rate limits, with a new `api` step for writing endpoints, graded by rules.
   - An "API" tab on named services (`DNode.api: Endpoint[]`), checked by goals such as "POST /urls is idempotent".
4. **Case studies (`/cases`):** step-by-step worked problems in interview order (requirements → estimates → API → high-level design → deep dives). At each decision the learner commits to a choice, then a `reveal` step shows the expert's pick and reasoning next to theirs. They use named services and API steps.

## 1. PocketBase backend

**Why:** accounts, syncing progress across devices, and a home for content and AI features.

- **Auth:** PocketBase users (email/password plus OAuth: GitHub, Google).
- **Collections**

  | Collection | Key fields | Notes |
  |---|---|---|
  | `users` | built-in | |
  | `progress` | `user`, `completed` (json: lessonId → section kinds), `unlocked` (json), `testedOut` (json) | One row per user |
  | `runs` | `user`, `runKey` (`lessonId#section`), `tree` (json RunTree), `design` (json) | Mirrors `web/src/store/runs.ts` |
  | `notes` | `user`, `runKey`, `nodeId`, `text` | Could also stay inside `runs.tree` |
  | `lessons` | `id`, `chapter`, `order`, `body` (json Lesson) | Optional: move content out of the bundle so it can be edited without a deploy |

- **API rules:** every row is owner-only (`user = @request.auth.id`). `lessons` are public-read.
- **JS hooks (`pb_hooks/`):**
  - Validate `progress` writes: a section can't be completed unless the run's tree contains a node for its last step.
  - Validate the shape of the JSON fields.
- **Client:** add `PocketBaseRepo implements ProgressRepo` and swap it in `repo/storage.ts`. Stores keep using zustand `persist`. On first login, merge local progress into the server copy.

## 2. Go extension (PocketBase as a framework)

Build PocketBase from Go (`pocketbase.New()` plus custom routes) when we need server logic:

- **AI mentor endpoint:** `POST /api/mentor` streams a reply.
  - Context: the current lesson, step, design (JSON) and the learner's timeline.
  - Model: Claude (latest Sonnet/Opus).
  - The frontend `MentorSource` (`web/src/features/mentor/source.ts`) gets an `aiMentor` implementation: `reply()` calls this endpoint, and `hints()` can become adaptive.
- **Reasoning grading:** grade free-text notes against each step's correct reason with an LLM rubric. The result is stored on the decision node.
- **Agentic interviewer mode:** an interviewer agent asks follow-up questions about the learner's capstone design ("what happens if the cache dies?"). It can trigger chaos scenarios through the same simulation engine.
- **Server-side verification:** re-run `runScenario` (port the solver to Go, or run the TS solver via goja) to verify capstone completions for leaderboards.
- **Score histograms (Opus Magnum-style):** p99, number of components and cost across all players for each capstone.

## 3. Content

- **Chapter 2: classic interview problems,** reusing Chapter 1's blocks plus a few new ones:
  - Rate limiter
  - Consistent hashing
  - Key-value store
  - Unique ID generator
  - Notification system
  - News feed
  - Chat
  - Search autocomplete
- **New blocks:** API gateway / rate limiter, search index, stream processor, blob CDN tiers, OLAP store.
- **Spaced review levels:** an old concept under new conditions (for example, the cache lesson revisited during a hotspot).

## 4. Product ideas parked for later

- XP, streaks and stars (deliberately left out of v1).
- Cost as a first-class metric ($/hour per block).
- Export a design to PNG (share links already exist in the sandbox).
- Sandbox leaderboards: breaking point and block count per challenge (needs the backend).
