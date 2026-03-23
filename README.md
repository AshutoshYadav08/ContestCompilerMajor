# Contest Compiler - API Only Wiring

This package keeps the frontend on plain HTTP API routes and runs code through a backend judge provider.

## Frontend flow
Browser -> Next.js `/api/*` proxy routes -> Convex HTTP Actions

## Environment
Create `.env.local` in the frontend root with:

```env
CONVEX_HTTP_URL=https://focused-donkey-989.convex.site
NEXT_PUBLIC_CONVEX_HTTP_URL=https://focused-donkey-989.convex.site
```

For real JDoodle execution, add these backend env vars in Convex deployment settings or your local backend env:

```env
JDOODLE_BASE_URL=https://api.jdoodle.com/v1
JDOODLE_CLIENT_ID=your_client_id
JDOODLE_CLIENT_SECRET=your_client_secret
```

If the JDoodle credentials are not set, the backend uses the built-in fake evaluator so the queued run/submit UX still works.

## What changed
- `lib/apiClient.ts` uses `fetch` only.
- `app/api/*` routes proxy to Convex HTTP endpoints.
- `backend-api/` contains the Convex HTTP actions backend.
- Official submissions are judged asynchronously and update derived standings.
- Problems now carry runtime metadata that maps cleanly to JDoodle language/version pairs.

## Deploy backend
From `backend-api/`:
1. `npm install`
2. `npx convex dev`
3. `npx convex deploy`

## Frontend run
From the project root:
1. `npm install`
2. `npm run dev`
