# Roadmap

v1 (this repo, `web/`) is a frontend-only app. Progress, decision timelines and notes live in the browser's localStorage behind a small repository interface (`web/src/repo/storage.ts`). The pieces below are planned, not built.

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

- A sandbox mode that only offers unlocked blocks.
- XP, streaks and stars (deliberately left out of v1).
- Cost as a first-class metric ($/hour per block).
- Shareable design links and an export to PNG.
