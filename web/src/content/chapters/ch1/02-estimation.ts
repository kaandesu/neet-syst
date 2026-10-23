import type { Lesson } from '@/engine/lesson/types'
import { EMPTY } from './_kit'

export const estimation: Lesson = {
  id: 'estimation',
  chapter: 'ch1',
  kind: 'unit',
  title: 'Back-of-the-envelope math',
  concern: 'How many servers do you actually need? Guessing isn’t good enough.',
  unlocks: [],
  sections: [
    {
      kind: 'concept',
      title: 'Three cheat codes',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          text: 'Interviewers don’t want precision. They want the **right order of magnitude, fast**, and your assumptions said out loud. Three cheat codes get you there.',
        },
        {
          t: 'say',
          text: '**1. A day has ~100,000 seconds.** (86,400, but round it.) So **1 million requests a day ≈ 10 per second**. A month is ~2.5 million seconds.',
        },
        {
          t: 'say',
          text: '**2. Powers of two ≈ powers of ten.** 2¹⁰ ≈ a thousand (KB) · 2²⁰ ≈ a million (MB) · 2³⁰ ≈ a billion (GB) · 2⁴⁰ ≈ a trillion (TB).',
        },
        {
          t: 'say',
          text: '**3. The latency ladder.** Memory read ~100 ns → SSD read ~100 µs → round trip inside a data center ~0.5 ms → disk seek ~10 ms → US ↔ Europe ~150 ms. Each rung is roughly 10–100× slower than the one before.',
        },
        {
          t: 'reason',
          question: 'Which of these is **fastest**?',
          options: [
            {
              id: 'mem',
              text: 'Reading 1 MB sequentially from memory',
              correct: true,
              why: 'About 0.25 ms. Memory is king, which is exactly why caches exist.',
            },
            { id: 'ssd', text: 'Reading 1 MB sequentially from an SSD', why: 'About 1 ms: fast, but ~4× slower than memory.' },
            {
              id: 'atlantic',
              text: 'One tiny network round trip from the US to Europe',
              why: '~150 ms, no matter how small the message. It’s bounded by the speed of light in fiber.',
            },
          ],
        },
      ],
    },
    {
      kind: 'drill',
      title: 'Warm-up estimates',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        { t: 'say', text: 'Answers within **2×** count. That’s the precision interviews actually care about.' },
        {
          t: 'estimate',
          question: 'A service handles **10 million requests per day**. About how many requests **per second** is that on average?',
          unit: 'req/s',
          answer: 116,
          tolerance: 2,
          working: '10,000,000 ÷ 100,000 s ≈ **100 req/s** (exactly ~116).',
          hints: ['Use the cheat code: a day ≈ 100,000 seconds.'],
        },
        {
          t: 'estimate',
          question: 'Traffic isn’t flat: at peak it’s **3×** the average. What’s the peak?',
          unit: 'req/s',
          answer: 350,
          tolerance: 2,
          working: '~116 × 3 ≈ **350 req/s**. Always size for the peak, not the average.',
        },
        {
          t: 'estimate',
          question: 'Each of those 10M daily requests stores **1 KB**. How much new data per **year**, in GB?',
          unit: 'GB',
          answer: 3650,
          tolerance: 2,
          working: '10M × 1 KB = 10 GB/day → × 365 ≈ **3,650 GB ≈ 3.6 TB per year**.',
          hints: ['First find GB per day: 10 million KB = 10 GB.'],
        },
      ],
    },
    {
      kind: 'level',
      title: 'Size your shop',
      startDesign: EMPTY,
      palette: [],
      goals: [],
      steps: [
        {
          t: 'say',
          text: 'Your shop is growing fast. Product says: **5 million daily active users**, each viewing **~20 pages** and placing **~2 writes** (cart updates, orders) a day.',
        },
        {
          t: 'estimate',
          question: 'Average **read** requests per second?',
          unit: 'req/s',
          answer: 1157,
          tolerance: 2,
          working: '5M × 20 = 100M reads/day ÷ 100,000 s ≈ **1,000 req/s** (exactly ~1,157).',
        },
        {
          t: 'estimate',
          question: 'Average **write** requests per second?',
          unit: 'req/s',
          answer: 116,
          tolerance: 2,
          working: '5M × 2 = 10M writes/day ÷ 100,000 ≈ **100 req/s**. Reads outnumber writes 10 to 1, and that ratio will shape your design.',
        },
        {
          t: 'estimate',
          question: 'Peak is **3×** average. If one web server handles ~**1,000 req/s**, how many servers do you need at peak, with room for one to fail?',
          unit: 'servers',
          answer: 5,
          tolerance: 1.5,
          working:
            'Peak ≈ 3 × (1,157 + 116) ≈ 3,800 req/s → **4 servers**, plus **1 spare** so a crash doesn’t overload the rest = **5**.',
          hints: ['Add reads and writes, multiply by 3, divide by 1,000, then add a spare.'],
        },
        {
          t: 'reason',
          question: 'Your math says ~5 servers. What does that imply about the design?',
          options: [
            {
              id: 'lb',
              text: 'Users need a single entry point that spreads requests across many servers',
              correct: true,
              why: 'Exactly what the next lesson unlocks. Numbers aren’t trivia: they **justify** every box you draw.',
            },
            {
              id: 'bigger',
              text: 'Just buy one server that’s 5× bigger',
              why: 'Tempting, and sometimes right early on. But it has a ceiling, gets expensive fast, and is still a single point of failure.',
            },
            {
              id: 'nosql',
              text: 'Switch to NoSQL',
              why: 'The database isn’t the bottleneck here; the web tier is. Always fix the bottleneck the numbers point to.',
            },
          ],
        },
      ],
    },
  ],
}
