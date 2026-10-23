# neet·syst

LeetCode for system design, built to **teach** rather than to be a free-form sandbox.

Every lesson starts with a problem your system can't handle yet: traffic grows, a database dies, users show up in Europe. You unlock **one** new building block, learn why it exists, practice it in a tiny drill, then use it to save the day in a guided level. A light simulation shows the system failing and then recovering. Every decision you make is recorded on a **branching timeline**, so you can rewind, take the other path, and compare the two.

## What's in v1

- **Chapter 1, "Scale from Zero to Millions":** 12 lessons and 2 capstones (a URL shortener and Pastebin at 10M users), plus a test-out checkpoint.
- **Lesson structure:** each lesson runs Concept → Drill → Level.
- **Guided canvas:** the palette only offers the blocks you've unlocked, ghost slots show where to drop them early on, and capstones are free-build.
- **Simulation:** a deterministic steady-state flow solver that models load, latency, caches, replicas, CDN, regions, queues, sharding, sessions and chaos events.
- **Decisions:** reasoning MCQs, design forks, scoping and estimation exercises.
- **Mentor:** a scripted mentor panel built as a message stream, so an AI mentor can plug in later.
- **Progress:** stored locally. There is no backend yet; see [docs/ROADMAP.md](docs/ROADMAP.md).

## Run it

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm test           # engine + content tests (every lesson auto-played)
npm run e2e        # Playwright smoke test (needs: npx playwright install chromium-headless-shell)
npm run build
```

## Layout

```
web/src/
  engine/     pure TS: sim solver + goals, lesson runner, timeline tree (unit tested)
  content/    block catalog + chapter lessons (typed)
  features/   canvas, mentor, timeline, lesson page, map, collection, unlock
  store/      zustand stores (progress, runs) persisted via repo/
docs/         ROADMAP.md (PocketBase + Go, AI mentor), CONTENT_GUIDE.md
```

Credits: some content is adapted from [The System Design Primer](https://github.com/donnemartin/system-design-primer) (CC BY 4.0). See the in-app Credits page.
