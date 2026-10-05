# BTT SDK

A TypeScript SDK and background-processing toolkit for working with Bitcointalk data and automation.

> **Status:** Beta — `0.1.0`
>
> The API and internal architecture are still evolving. Full end-to-end testing is ongoing.

## Overview

BTT SDK is built around long-running Bitcointalk automation rather than one-off scraping requests. It combines HTTP/browser-based access, persistence, Redis-backed coordination, background jobs, board activity monitoring, and spam-analysis utilities into a single TypeScript codebase.

The current architecture is designed around four main concerns:

- **Scraping and authenticated access** to Bitcointalk pages.
- **Background processing** with BullMQ workers.
- **Shared state and coordination** using Redis and MongoDB.
- **Activity and spam analysis** for board and user activity.

## Current Features

### Bitcointalk access

- HTTP requests through the SDK request layer.
- Playwright-based browser automation for authenticated flows.
- Login/session cookie reuse through MongoDB.
- HTML parsing with Cheerio.
- Board and post activity extraction.

### Board monitoring

- Watch Bitcointalk boards for new activity.
- Resolve whether a board is a main board or child board.
- Cache board activity in Redis.
- Persist board activity in MongoDB.
- Queue background work with BullMQ.
- Publish board events for consumers.
- Deduplicate repeated activity using deterministic activity identifiers.

### Spam detection

The spam-analysis pipeline combines multiple signals rather than relying on a single similarity score, including:

- Semantic similarity.
- Lexical similarity.
- Sentence-level matching and coverage.
- Context/topic relevance.
- Reply/quote relationships.
- Information-density and novelty signals.
- Reranker-based scoring.

The goal is to distinguish genuinely relevant replies from replies that substantially rehash existing content.

### Background workers

BullMQ is used to separate expensive or recurring work from the main application flow. Workers currently handle tasks such as board monitoring and queued board spam checks.

### Redis coordination

Redis is used for shared state and coordination across jobs/workers, including cached activity, board-related state, and subscription/watch information.

### Event-driven processing

The project uses an event hub and Socket.IO for propagating board events to interested consumers.

## Architecture

At a high level, the system follows this flow:

```text
                    Bitcointalk
                         │
             ┌───────────┴───────────┐
             │                       │
        HTTP requests          Playwright
             │                       │
             └───────────┬───────────┘
                         │
                    Scraper layer
                         │
               ┌─────────┴─────────┐
               │                   │
            MongoDB              Redis
               │                   │
               └─────────┬─────────┘
                         │
                    BullMQ queues
                         │
                    Worker processes
               ┌─────────┴─────────┐
               │                   │
         Board activity       Spam analysis
               │                   │
               └─────────┬─────────┘
                         │
                  Event publishing
                         │
                    Consumers / SDK
```

Redis is intended for fast shared state and coordination, while MongoDB provides persistent storage. BullMQ sits between producers and workers so monitoring and analysis can run asynchronously.

## Tech Stack

- **TypeScript**
- **Node.js**
- **Axios** — HTTP requests
- **Cheerio** — HTML parsing
- **Playwright** — browser automation/authenticated flows
- **BullMQ** — background jobs
- **Redis / ioredis** — shared state and coordination
- **MongoDB / Mongoose** — persistence
- **Socket.IO** — event delivery
- **Zod** — environment/configuration validation
- **EventEmitter3** — internal event handling
- **P-Queue / async-mutex** — asynchronous coordination where required
- **Hugging Face Transformers / ONNX Runtime** — semantic model inference

## Requirements

You need:

- Node.js
- npm
- MongoDB
- Redis
- A Bitcointalk account for authenticated functionality

The current development environment uses Node.js `22.x`.

Some authenticated browser features also require the Playwright browser binaries to be installed.

## Installation

Clone the repository:

```bash
git clone https://github.com/eclipse01-oe/btt-sdk.git
cd btt-sdk
```

Install dependencies:

```bash
npm install
```

Build the TypeScript project:

```bash
npm run build
```

If Playwright reports missing browser binaries, install the required browser with:

```bash
npx playwright install
```

## Configuration

Environment variables are validated through the project's Zod configuration layer.

Create a `.env` file in the project root and provide the values required by the current configuration in:

```text
src/config/zod.ts
```

Do not commit `.env` files, credentials, session cookies, API keys, or database credentials to the repository.

A typical local setup needs access to:

```text
MongoDB
Redis
Bitcointalk credentials/session information
```

The exact environment variable names intentionally follow the application's current configuration schema rather than being duplicated here, so the README does not become stale when configuration changes.

## Running the project

The repository contains application workers and supporting services in addition to the SDK code. Available npm scripts can be inspected with:

```bash
npm run
```

The TypeScript production build is generated with:

```bash
npm run build
```

Run the appropriate worker/application scripts from `package.json` for the part of the system you want to operate.

## Board monitoring flow

A board watch follows the general flow below:

```text
Watch request
     │
     ▼
Board subscription/state
     │
     ▼
BullMQ board job
     │
     ▼
Fetch latest board activity
     │
     ▼
Compare with cached activity
     │
     ├── No change ──► stop
     │
     ▼
Persist activity
     │
     ├──► Publish board:new event
     │
     └──► Queue spam analysis
```

Activity is given a deterministic `postId` derived from the relevant post/topic information and timestamp. This allows repeated polling to be filtered before unnecessary downstream work is performed.

## Spam-analysis flow

The spam checker is designed as a collection of independent signals rather than a single binary rule:

```text
Candidate reply
      │
      ├── Semantic similarity
      ├── Lexical similarity
      ├── Sentence matching
      ├── Topic/context relevance
      ├── Quote/reply relationships
      ├── Novelty / information density
      └── Reranker score
               │
               ▼
          Combined analysis
               │
               ▼
        Spam/risk assessment
```

This makes it possible to distinguish between replies that discuss the same topic and replies that simply reproduce the substance of existing replies.

## Project structure

The repository is organized around configuration, services, scrapers, workers, queues, utilities, and event handling. Some of the important areas include:

```text
src/
├── config/          # Environment, Redis, BullMQ and application configuration
├── event/           # Event publishing / event hub
├── scrappers/       # Bitcointalk scraping logic
├── services/        # Shared application services
├── utils/           # Parsing, board, spam and supporting utilities
├── workers/         # Background workers
└── workerJobs/      # Queue/job handlers
```

The exact structure may evolve while the SDK remains in beta.

## Development

Type-check/build the project with:

```bash
npm run build
```

Before making architectural changes, check how the existing queues, Redis state, MongoDB persistence, and workers interact. Several operations are intentionally asynchronous and may execute across multiple worker processes.

## Redis and concurrency

Redis is not only used as a cache. It is also part of the coordination layer for shared state and worker activity.

When multiple workers can operate on the same logical resource, local JavaScript synchronization primitives are not sufficient because a mutex in one Node.js process cannot lock another process. Cross-process coordination therefore belongs in Redis-backed mechanisms rather than process-local state.

## Testing status

The project currently contains tests and development checks for parts of the scraping, parsing, fitting/scoring, and worker logic, but the `1.0.0` release should still be considered a **beta**.

Recommended validation before treating a deployment as production-ready:

1. Verify environment/configuration values.
2. Verify MongoDB and Redis connectivity.
3. Verify authenticated Bitcointalk login/session handling.
4. Run board watcher flows against a test board.
5. Verify queue retries/deduplication.
6. Verify event delivery.
7. Run spam detection against representative replies and edge cases.
8. Monitor workers for duplicate processing and race conditions.

## Contributing

The project is currently under active development. Keep changes focused and preserve existing interfaces unless an API change is intentional.

For worker/queue changes, pay particular attention to:

- Job IDs and idempotency.
- Redis state consistency.
- Multiple workers processing the same board.
- Failure/retry behaviour.
- MongoDB persistence versus Redis cache state.
- Event publishing failures.

## License

License information has not yet been finalized for this beta release.

## Disclaimer

This project is an independent software project for interacting with Bitcointalk. Users are responsible for complying with Bitcointalk's rules, applicable API/site policies, and all relevant laws when using the SDK.
