import type { Chapter } from '@/engine/lesson/types'
import { firstRequest } from './00-first-request'
import { database } from './01-database'
import { estimation } from './02-estimation'
import { loadBalancer } from './03-load-balancer'
import { replication } from './04-replication'
import { cache } from './05-cache'
import { cdn } from './06-cdn'
import { urlShortener } from './c1-url-shortener'
import { stateless } from './07-stateless'
import { multiRegion } from './08-multi-region'
import { queue } from './09-queue'
import { monitoring } from './10-monitoring'
import { sharding } from './11-sharding'
import { pastebin } from './c2-pastebin'
import { checkpoint } from './checkpoint'

export const chapter1: Chapter = {
  id: 'ch1',
  title: 'Scale from Zero to Millions',
  subtitle: 'One system, one new problem at a time.',
  lessons: [
    firstRequest,
    database,
    estimation,
    loadBalancer,
    replication,
    cache,
    cdn,
    urlShortener,
    stateless,
    multiRegion,
    queue,
    monitoring,
    sharding,
    pastebin,
  ],
}

export const chapter1Checkpoint = checkpoint
