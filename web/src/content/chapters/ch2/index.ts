import type { Chapter } from '@/engine/lesson/types'
import { resources } from './00-resources'
import { idempotency } from './01-idempotency'
import { limits } from './02-limits'

export const chapter2: Chapter = {
  id: 'ch2',
  title: 'Design the API',
  subtitle: 'The contract other people build on.',
  story: 'Your shop is big enough that other people want to build on it: a mobile app, partner stores, and, unfortunately, scrapers. Every episode, the API you publish has to survive a new kind of caller.',
  requires: 'ch1',
  lessons: [resources, idempotency, limits],
}
