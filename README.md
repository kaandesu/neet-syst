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
- **Sandbox (`/sandbox`):** free build with only the blocks you've earned. Traffic dials appear as you unlock the blocks they matter for. The page shows your design's **breaking point** (the most req/s it takes before 1% of requests fail) and which part gives out first. You can kill any block to test failover, and **Review** flags wiring mistakes and single points of failure on the canvas. Seven open-ended challenges unlock with your blocks. **Share** copies a link that carries the whole design.
- **Skins:** a header picker switches the whole app between Current (light/dark), NEET.SYS (pixel terminal) and Factory (pixel factory floor). The canvas follows the skin too.
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

**Dev mode (for testing):** tick the "Dev mode" box on the map (dev builds), or open `/?dev=1` in any build (`/?dev=0` turns it off). Every lesson and section opens, and a **Skip section** button in the lesson header auto-completes the current section like an ideal learner.

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
