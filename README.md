This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Distributed API rate limiting

API rate limits use an atomic Lua counter in Upstash Redis. Configure these
environment variables in every Vercel environment before deploying:

```text
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RATE_LIMIT_REDIS_PREFIX=myuni:ratelimit
HEALTHCHECK_SECRET=
```

Local development falls back to an in-memory limiter. On Vercel, the public
`/api/health` endpoint reports only `healthy` or `degraded`; it does not expose
component names, errors, or latency. Detailed database, payment, and rate-limit
checks are available from `/api/health/details` with an
`Authorization: Bearer <HEALTHCHECK_SECRET>` header. Health results are cached
for 45 seconds to limit database traffic. Redis outages fail over to the local
limiter to preserve API availability.
