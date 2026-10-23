import {
  Activity,
  Archive,
  Cog,
  Database,
  DatabaseBackup,
  DatabaseZap,
  Earth,
  Globe,
  KeyRound,
  ListOrdered,
  MonitorSmartphone,
  Network,
  Server,
  Signpost,
  Split,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { BlockId } from '@/engine/types'

export interface BlockInfo {
  id: BlockId
  name: string
  /** Short label shown on canvas nodes. */
  short: string
  icon: LucideIcon
  /** Hue (0-360) for the block's illustrated color. */
  hue: number
  tagline: string
  concept: {
    what: string
    why: string
    analogy: string
    tradeoffs: string[]
    examples: string
  }
}

export const BLOCKS: Record<BlockId, BlockInfo> = {
  client: {
    id: 'client',
    name: 'Client',
    short: 'Users',
    icon: MonitorSmartphone,
    hue: 220,
    tagline: 'Browsers and apps sending requests',
    concept: {
      what: 'The browser or mobile app your users hold. Every request in your system starts here.',
      why: 'Designs are judged from the user’s seat: how fast does a page load, and does it load at all?',
      analogy: 'A customer walking into your shop.',
      tradeoffs: ['You don’t control the client’s network, device or location.'],
      examples: 'Chrome, an iOS app, curl',
    },
  },
  dns: {
    id: 'dns',
    name: 'DNS',
    short: 'DNS',
    icon: Signpost,
    hue: 260,
    tagline: 'Turns names into IP addresses',
    concept: {
      what: 'The Domain Name System maps a name like shop.example.com to the IP address of your server.',
      why: 'Users remember names, but computers connect to addresses. DNS also lets you change servers without changing your URL.',
      analogy: 'The internet’s phone book.',
      tradeoffs: [
        'Answers are cached for a TTL, so changes take time to spread.',
        'Usually a managed service (Route 53, Cloudflare), so you rarely run it yourself.',
      ],
      examples: 'Route 53, Cloudflare DNS, Google Cloud DNS',
    },
  },
  'web-server': {
    id: 'web-server',
    name: 'Web Server',
    short: 'Server',
    icon: Server,
    hue: 200,
    tagline: 'Runs your application code',
    concept: {
      what: 'A machine running your application: it receives HTTP requests, runs business logic and returns HTML or JSON.',
      why: 'This is where your product actually lives. In the beginning, one server can do everything.',
      analogy: 'The cook in a one-person restaurant: takes orders, cooks, and washes dishes.',
      tradeoffs: [
        'One server has a hard ceiling on CPU and memory.',
        'If it dies, your whole product is down.',
      ],
      examples: 'A Node, Go, Java or Python app on a VM or container',
    },
  },
  'sql-db': {
    id: 'sql-db',
    name: 'SQL Database',
    short: 'SQL DB',
    icon: Database,
    hue: 150,
    tagline: 'Tables, joins and transactions',
    concept: {
      what: 'A relational database stores data in tables with a fixed schema and lets you join them and change many rows in one ACID transaction.',
      why: 'When data is related (users → orders → items) and must stay correct (money, stock), relational is the safe default.',
      analogy: 'A meticulous accountant with ledgers that always balance.',
      tradeoffs: [
        'Strong consistency and powerful queries.',
        'Scaling writes beyond one machine is hard (that’s what sharding is for).',
      ],
      examples: 'PostgreSQL, MySQL, SQL Server',
    },
  },
  'nosql-db': {
    id: 'nosql-db',
    name: 'NoSQL Database',
    short: 'NoSQL',
    icon: DatabaseZap,
    hue: 170,
    tagline: 'Flexible schema, built to scale out',
    concept: {
      what: 'Key-value, document, wide-column or graph stores that drop the rigid schema and most cross-record transactions in exchange for speed and easy horizontal scale.',
      why: 'Great for huge volumes of simple lookups by key, flexible data, or very high write rates.',
      analogy: 'A giant warehouse of labeled boxes: grab any box by its label instantly, but don’t ask it to cross-reference.',
      tradeoffs: [
        'Fast, simple access patterns and easy to scale.',
        'Joins and multi-item transactions move into your application code.',
      ],
      examples: 'DynamoDB, MongoDB, Cassandra, Redis',
    },
  },
  'load-balancer': {
    id: 'load-balancer',
    name: 'Load Balancer',
    short: 'LB',
    icon: Split,
    hue: 30,
    tagline: 'Spreads traffic across servers',
    concept: {
      what: 'Sits in front of a pool of servers and forwards each request to a healthy one. Users only ever see the load balancer’s address.',
      why: 'It lets you scale out (add servers) and survive failures: health checks stop traffic to dead servers automatically.',
      analogy: 'A host at a busy restaurant seating guests at whichever table is free.',
      tradeoffs: [
        'Adds ~1–2 ms per request.',
        'Managed load balancers run redundantly, so they aren’t a single point of failure in practice.',
      ],
      examples: 'AWS ALB/NLB, NGINX, HAProxy, Envoy',
    },
  },
  'read-replica': {
    id: 'read-replica',
    name: 'Read Replica',
    short: 'Replica',
    icon: DatabaseBackup,
    hue: 140,
    tagline: 'A read-only copy of the database',
    concept: {
      what: 'A copy of the primary database that receives every change and serves read queries. Writes still go to the primary.',
      why: 'Most apps read far more than they write, so replicas absorb most of the load. If the primary dies, a replica can be promoted.',
      analogy: 'Photocopies of the master ledger that many clerks can read at once.',
      tradeoffs: [
        'Replication lag: a replica can be milliseconds to seconds behind.',
        'Does not help with write volume.',
      ],
      examples: 'PostgreSQL streaming replicas, MySQL replicas, Aurora replicas',
    },
  },
  cache: {
    id: 'cache',
    name: 'Cache',
    short: 'Cache',
    icon: Zap,
    hue: 50,
    tagline: 'Keeps hot data in memory',
    concept: {
      what: 'An in-memory key-value store that holds the results of expensive reads. Cache-aside: check the cache, and on a miss read the DB and store the result.',
      why: 'Memory is ~100× faster than a database query, and popular data is read over and over. A good cache absorbs most reads.',
      analogy: 'Keeping the most-asked-for items on the counter instead of in the back room.',
      tradeoffs: [
        'Stale data: you must expire (TTL) or invalidate entries.',
        'A cold or flushed cache sends all traffic to the DB at once (thundering herd).',
      ],
      examples: 'Redis, Memcached',
    },
  },
  cdn: {
    id: 'cdn',
    name: 'CDN',
    short: 'CDN',
    icon: Globe,
    hue: 280,
    tagline: 'Serves static files from near the user',
    concept: {
      what: 'A content delivery network: a fleet of edge servers around the world that cache your images, scripts and videos close to users.',
      why: 'Static files are often most of your bytes. Serving them from the edge cuts latency for distant users and takes load off your servers.',
      analogy: 'Vending machines in every neighbourhood instead of one central store.',
      tradeoffs: [
        'You pay per GB transferred.',
        'Updating a file means waiting for the TTL or versioning file names (app.v42.js).',
      ],
      examples: 'Cloudflare, CloudFront, Fastly, Akamai',
    },
  },
  'object-storage': {
    id: 'object-storage',
    name: 'Object Storage',
    short: 'Storage',
    icon: Archive,
    hue: 300,
    tagline: 'Cheap, durable storage for files',
    concept: {
      what: 'A managed service that stores files (objects) by key with very high durability, practically unlimited size, and a low price.',
      why: 'Uploaded images, videos and backups don’t belong on web servers or in a database. Object storage is the CDN’s origin.',
      analogy: 'A huge, fireproof self-storage facility.',
      tradeoffs: ['Higher latency than local disk (tens of ms), which is why a CDN sits in front.'],
      examples: 'Amazon S3, Google Cloud Storage, Cloudflare R2',
    },
  },
  'session-store': {
    id: 'session-store',
    name: 'Session Store',
    short: 'Sessions',
    icon: KeyRound,
    hue: 10,
    tagline: 'Shared memory of who is logged in',
    concept: {
      what: 'A fast shared store (usually Redis) holding session data: who the user is and what’s in their cart, keyed by a session ID cookie.',
      why: 'When sessions live outside the web servers, any server can handle any request. That makes the web tier stateless: add, remove or lose servers freely.',
      analogy: 'A shared reservation book at the front desk instead of each waiter’s memory.',
      tradeoffs: [
        'One more network hop (~1 ms) per request.',
        'Must itself be replicated; we treat it as a managed, redundant service.',
      ],
      examples: 'Redis, Memcached, DynamoDB',
    },
  },
  'geo-dns': {
    id: 'geo-dns',
    name: 'Geo DNS',
    short: 'Geo DNS',
    icon: Earth,
    hue: 240,
    tagline: 'Sends users to the nearest region',
    concept: {
      what: 'DNS that answers differently depending on where the user is, pointing each user at the closest healthy data center.',
      why: 'Light is slow at planet scale: a US↔Europe round trip is ~100–150 ms. Serving users from their own region removes it, and a whole region can fail over to another.',
      analogy: 'A call center that routes you to the office in your time zone.',
      tradeoffs: [
        'You now run multiple full stacks.',
        'Data must be synchronized across regions (replication, conflict handling).',
      ],
      examples: 'Route 53 latency/geo routing, Cloudflare load balancing',
    },
  },
  'message-queue': {
    id: 'message-queue',
    name: 'Message Queue',
    short: 'Queue',
    icon: ListOrdered,
    hue: 330,
    tagline: 'Hands work off to do later',
    concept: {
      what: 'A durable buffer: producers put messages (jobs) in, consumers take them out and process them at their own pace.',
      why: 'Slow work (resizing images, sending emails) shouldn’t make users wait. The web server enqueues a job and answers right away.',
      analogy: 'The order ticket rail in a kitchen: the waiter clips the ticket and goes back to customers.',
      tradeoffs: [
        'The work becomes asynchronous: results arrive later.',
        'You need to handle retries and duplicate messages.',
      ],
      examples: 'RabbitMQ, Amazon SQS, Kafka',
    },
  },
  worker: {
    id: 'worker',
    name: 'Worker',
    short: 'Worker',
    icon: Cog,
    hue: 0,
    tagline: 'Processes jobs from the queue',
    concept: {
      what: 'A background process that pulls jobs from a queue and does the slow work.',
      why: 'Workers scale independently of web servers: add more when the queue grows, remove them when it’s empty.',
      analogy: 'Kitchen cooks working through the ticket rail.',
      tradeoffs: ['If workers can’t keep up, the queue grows and results get later and later (but nothing is lost).'],
      examples: 'Celery, Sidekiq, a Go consumer, AWS Lambda',
    },
  },
  monitoring: {
    id: 'monitoring',
    name: 'Monitoring',
    short: 'Metrics',
    icon: Activity,
    hue: 100,
    tagline: 'Logs, metrics and alerts',
    concept: {
      what: 'Collects logs and metrics from every component (CPU, error rate, latency, queue depth) and alerts a human when something looks wrong.',
      why: 'At scale, something is always broken somewhere. Without monitoring you find out from angry users, and you can’t tell which box is the problem.',
      analogy: 'The dashboard and warning lights in a car.',
      tradeoffs: ['Costs money and attention; too many alerts and people start ignoring them.'],
      examples: 'Prometheus + Grafana, Datadog, CloudWatch',
    },
  },
  'shard-router': {
    id: 'shard-router',
    name: 'Shard Router',
    short: 'Shards',
    icon: Network,
    hue: 120,
    tagline: 'Splits data across many databases',
    concept: {
      what: 'Splits one big dataset across several databases (shards) by a shard key, for example user_id mod N, and sends each query to the right shard.',
      why: 'When data or write volume outgrows the biggest single machine, the only way forward is to split it.',
      analogy: 'A library splitting books across buildings: A–H here, I–P there.',
      tradeoffs: [
        'Cross-shard joins and transactions get hard.',
        'A bad shard key creates hotspots (one celebrity, one shard).',
        'Adding shards later means moving data (resharding).',
      ],
      examples: 'Vitess, Citus, MongoDB sharding, app-level routing',
    },
  },
}

export const blockInfo = (id: BlockId) => BLOCKS[id]
