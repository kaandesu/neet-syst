# Writing a lesson

Lessons are typed TypeScript in `web/src/content/chapters/<chapter>/`. The types live in `web/src/engine/lesson/types.ts`.

## Shape

Each lesson has three sections, in this order:

1. **`concept`**: introduce the problem and the block (`concept` step), then check understanding with a `reason` MCQ. No canvas.
2. **`drill`**: a tiny isolated canvas exercise that uses the new block once.
3. **`level`**: the evolving system. Follow this rhythm:
   1. A `simulate` step with `expect: 'fail'`, so the learner feels the pain.
   2. `place` / `connect` / `disconnect` steps (or a `fork`) to fix it.
   3. A `simulate` step with `expect: 'pass'`.
   4. A chaos `simulate`.
   5. A `reason` step.

A capstone replaces the guided steps with `requirements` and `estimate` steps, then a single free-build `simulate` that includes a `solution`.

## Rules of thumb

- **One new block per lesson.** Each level's `palette` should only contain blocks unlocked by earlier lessons, plus this one. A test enforces it.
- **Start from the previous level's end state.** Use the designs in `ch1/_states.ts`.
- **Give early `place` steps a `slot`** so a ghost appears. Drop slots in capstones.
- **Write wrong `reason` options that are tempting,** and explain in their `why` why each one is wrong.
- **Make both `fork` options valid.** The first option must pass the rest of the section, because tests auto-play option 0.
- **Use round numbers.** Simulator capacities are in `web/src/engine/sim/specs.ts`: web server 1,000 units/s, SQL 2,000, a write costs 2, and so on.

## Checking your lesson

Run:

```bash
cd web && npm test
```

`src/content/content.test.ts` auto-plays every section like an ideal learner. It fails if:

- an `expect: 'fail'` step passes, or an `expect: 'pass'` step fails;
- a `place` step's block isn't in the palette;
- a palette offers a block that hasn't been unlocked yet.

Register new lessons in the chapter's `index.ts`.
