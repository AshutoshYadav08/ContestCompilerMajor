# Contest Compiler Backend API

This backend exposes HTTP Actions for the frontend to call through plain API requests.

## Routes
- `POST /api/bootstrap`
- `GET /api/users`
- `GET /api/contests`
- `POST /api/contests`
- `GET /api/contest?id=...`
- `POST /api/join-request`
- `POST /api/join-request/review`
- `POST /api/run-code`
- `GET /api/run-code?id=...`
- `POST /api/submissions`
- `GET /api/submissions?id=...`

## Judge provider
The backend dispatches queued runs and official submissions to JDoodle when these env vars are present:
- `JDOODLE_BASE_URL`
- `JDOODLE_CLIENT_ID`
- `JDOODLE_CLIENT_SECRET`

If they are absent, the backend falls back to a fake evaluator for local testing.

## Deploy
1. Install dependencies in this folder.
2. Link this folder to your Convex project.
3. Run `npx convex dev` once for codegen.
4. Run `npx convex deploy` to publish the HTTP actions to your Convex deployment.
