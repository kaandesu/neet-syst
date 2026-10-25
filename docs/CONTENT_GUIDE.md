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

## Active learning hooks

- **Predict before Run.** Every `simulate` step with `expect: 'fail'` asks the learner which part breaks first. This happens automatically when the solver finds a bottleneck. Set `predict: false` to skip it, for example when the failure is purely about latency.
- **Diagnose.** When a learner's fix fails an `expect: 'pass'` step, they have to click the culprit before the hints appear. You don't need to write anything for this.
- **What-ifs (`tryIt`).** Give a *wrong* `reason` option a `tryIt: WhatIf` (a design, a scenario and goals), so learners can watch that idea fail. Shared ones live in `ch1/_whatifs.ts`. A test fails if a what-if actually passes.
- **Incidents.** These live in `ch1/incidents.ts`: one free-build `level` with a pager message, a failing replay, and a passing `solution`.
  - `due` names the lesson whose completion makes the incident appear on the map. Aim for 1–7 lessons after the concept it reviews.
  - `reviews` lists the blocks it exercises.
  - Its palette may only use blocks unlocked by the `due` lesson.

## The mentor (scripted, no AI)

- **Voices.** A `say` step can set `speaker: 'oncall' | 'pm'`, which shows that character's avatar and name. The cast lives in `content/voices.ts`. Leave the mentor as the default speaker.
- **Reactions.** `REACTIONS` in `content/voices.ts` decides what the cast says when a prediction is right or wrong, when a fix fails or passes after a struggle, or when the learner sits idle.
  - The first matching rule wins, so put specific ones first: those matching a block, a lesson kind, `minAttempts`, or `needsPast` (the learner struggled with this block in an earlier lesson).
  - Each rule's `lines` rotate, so it doesn't repeat itself.
  - Lines can use `{node}`, `{note}` and `{past}`.
- **Reply chips.** *Why does this matter?*, *Show me* and *I'm stuck* are answered by `features/mentor/coach.ts`. Most answers come from the step itself (block concepts, hints, the sim result), so new lessons get them for free. Write `hints` on steps where the generic ones aren't enough.
- **Design review.** `engine/mentor/lint.ts` flags wiring mistakes as warning bubbles on the canvas during must-pass runs. A test fails if an authored solution trips a rule, so add a rule only for mistakes that are wrong in *every* lesson.

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

## Problems (LeetCode-style track)

Problems live in `web/src/content/problems/`, one file per problem, registered in `index.ts`. The type is `Problem` in `web/src/engine/problems/types.ts`.

- **Story first.** A speaker, 1–3 short paragraphs, then `asks` (must work), `outOfScope` (red herrings), and `numbers`.
- **Difficulty is scaffolding.** Easy: a near-complete skeleton, one concept, the last hint carries a `ghost`. Medium: a partial skeleton, two concepts, a chaos test. Hard: client only, layered chaos, a tight `maxBlocks` budget.
- **Tests.** Each `TestCase` is judged as its own run against `goals`. Mark chaos and scale-ups `hidden: true`; they only run on Submit.
- **Hints.** Three of them: nudge → concept → near-answer. Using any costs the no-hints star.
- **`par`** is the reference solution's block count (excluding the client). Matching it earns a star.
- **`trap`** (optional) is the tempting wrong answer. It must pass the visible tests and fail a hidden one.

`src/content/problems.test.ts` checks:
- the solution passes every test, and the skeleton fails at least one
- `par` matches the solution's block count
- palettes only use blocks that can be unlocked
- the solution keeps every skeleton node and trips no lint
- the trap behaves as described
