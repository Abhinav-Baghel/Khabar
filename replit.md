# Khabar

Hyperlocal citizen journalism web app for Indian neighborhoods. Dark-mode newsroom feel, 4-tier verification chain, reputation-driven leaderboards, breaking news pulses.

## Stack

- React + Vite frontend at `artifacts/khabar`
- Express API at `artifacts/api-server` (mounted at `/api`)
- Postgres via Drizzle ORM in `lib/db`
- OpenAPI spec in `lib/api-spec` → generated Zod (`lib/api-zod`) and React Query hooks (`lib/api-client-react`)
- Replit Object Storage for profile photos (helpers in `lib/object-storage-web` and `artifacts/api-server/src/lib/objectStorage.ts`)

## Auth

Real email/password accounts:

- `POST /api/auth/register` — username (unique), email (unique), password (min 8), displayName, city, primaryLocality, optional phone, optional photoUrl. Server bcrypt-hashes password, issues JWT (`SESSION_SECRET`) in httpOnly cookie `khabar_token` (30d).
- `POST /api/auth/login` — email + password.
- `POST /api/auth/logout` — clears cookie.
- `GET /api/auth/me` — current user; `PATCH /api/auth/me` — update profile.
- `GET /api/auth/check-availability` — username/email availability.
- Frontend `AuthProvider` (`src/lib/auth.tsx`) keeps current user in context; `<AuthGate>` redirects anonymous users to `/login`. Login & Register pages render outside the gate.
- Profile photo upload: presigned PUT to `/api/storage/uploads/request-url` → object stored, path saved as `users.photoUrl` (rendered via `/api/storage/objects/...`).
- All write routes (`POST /posts`, `/posts/:id/vote`, `/save`, `/verify`) require auth via `requireAuth` middleware (JWT cookie or `Authorization: Bearer`). Reads remain public.
- No demo users — registration is the only way in.

## Pages

- `/login`, `/register` — authentication
- `/` Home — feed with category chip filter, breaking pinned, live indicator, 5 s refetch
- `/explore` — StatsOverview hero + Recharts category bar chart + dense post grid
- `/post` — submission form with Zod-validated `CreatePostBody`
- `/saved` — feed filtered by `savedBy=current uid`
- `/profile` — credibility dashboard with inline edit
- `/u/:id` — read-only public version of the dashboard

## Key files

- `lib/api-spec/openapi.yaml`
- `lib/api-zod/src/index.ts` (manual barrel — aliases colliding TS types as `TCreatePostBody`, `TLoginBody`, `TRegisterBody`, `TUpdateCurrentUserBody`, `TRequestUploadUrlBody`)
- `lib/db/src/schema/{users,posts,reputationEvents,postVotes,savedPosts}.ts`
- `artifacts/api-server/src/lib/{auth,serializers,objectStorage,objectAcl}.ts`
- `artifacts/api-server/src/routes/{auth,storage,users,posts,trends,health}.ts`
- `artifacts/khabar/src/lib/auth.tsx` (AuthProvider, useCurrentUser, authFetch, API_BASE_URL)
- `artifacts/khabar/src/components/{AuthGate,Layout,PostCard}.tsx`
- `artifacts/khabar/src/pages/{Login,Register,Home,Explore,PostNews,Saved,Profile,PublicProfile}.tsx`

## Verification + reputation

`POST /api/posts/:id/verify` advances/reverts the status (`unverified` → `community` → `editor` → `verified`) and writes a delta into `reputation_events` with rewards 0 / 5 / 10 / 20 respectively. Filing a post awards +1.

## Real-time feel

React Query `defaultOptions.queries` is configured with `refetchInterval: 5000` and `refetchOnWindowFocus: true`.

## Codegen

```
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck:libs
```

## DB push

```
pnpm --filter @workspace/db run push
```
