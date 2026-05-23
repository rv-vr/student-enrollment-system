# UniACES

UniACES (University Academic Course Enrollment System) is a high-performance, type-safe multi-role academic portal optimized for serverless edge infrastructure. It includes a student portal with tabbed views, an instructor interface for roster management and grade submissions, and an administrative control queue featuring an asynchronous approval-gate pipeline.

## Architecture & Tech Stack

This repository is organized as a Turborepo monorepo with the following production surfaces:

| Layer | Implementation | Notes |
| --- | --- | --- |
| Monorepo management | Turborepo | Root pipeline defined in `turbo.json` |
| Backend API engine | Hono | RPC-enabled API mounted from `apps/api/src/index.ts` and deployed as a Cloudflare Worker |
| Frontend app | SvelteKit / Svelte 5 | Client-side SPA behavior with route guards, layout shells, and utility-style component classes; deployed through Cloudflare Pages |
| Type contract | Hono `AppType` + Zod + `InferResponseType` | End-to-end typing flows from backend routes into the frontend RPC client |


### API routing map

The API entrypoint in `apps/api/src/index.ts` mounts the current route surface:

- `GET /` health / route index
- `POST /auth/login`
- `GET /courses`
- `GET /courses/:code/availability`
- `GET /students/:id/courses`
- `GET /students/:id/notifications`
- `POST /enroll`
- `POST /drop`
- `PATCH /grade`
- `PATCH /enrollments/:id/grade`
- `GET /admin/requests`
- `PATCH /admin/requests/:id/decide`
- `GET /instructor/classes`

### Frontend route map

The Svelte frontend currently includes these routes:

- `/login` 
- `/` 
- `/courses` 
- `/instructor` 
- `/admin` 

Shared client-side support lives in:

- `apps/web/src/lib/api/client.ts`
- `apps/web/src/lib/api/types.ts`
- `apps/web/src/lib/stores/auth.ts`
- `apps/web/src/lib/stores/student.ts`

## Environment Configuration Matrix

The repository currently uses the following exact environment variables and files.


| Scope | File | Variables | Purpose |
| --- | --- | --- | --- |
| Root workspace env | `.env` | `PUBLIC_LOCAL_API`, `PUBLIC_PROD_API`, `JWT_SECRET` | Turbo watches this file and the web build consumes the public API URLs |
| API local secret vault | `apps/api/.dev.vars` | `JWT_SECRET` | Wrangler local secret file for the Cloudflare Worker during development |
| API production secrets | Cloudflare Workers Dashboard / `wrangler secret put` | `JWT_SECRET` | Secure production secret used by `c.env.JWT_SECRET` |

Example root `.env`:

```env
PUBLIC_LOCAL_API=http://localhost:8787
PUBLIC_PROD_API=https://student-enrollment-system.pages.dev
JWT_SECRET=your-local-development-secret
```

Example local API secret file:

```env
# apps/api/.dev.vars
JWT_SECRET=your-local-development-secret
```

## Local Development Workflow

1. Install dependencies from the repository root:

```sh
npm install
```

2. Start both workspaces together:

```sh
npm run dev
```

3. Run lint checks:

```sh
npm run lint
```

4. Apply Prettier formatting:

```sh
npm run format
```

5. Run the test suite:

```sh
npm run test
```

6. Run a clean type and build verification pass:

```sh
npm run check-types
npm run build
```

## Cloudflare Edge Production Deployment Playbook

### Backend API deployment

The API is shipped as a Cloudflare Worker from `apps/api`.

```sh
npx wrangler deploy
```

Production secrets should be injected in Cloudflare directly, not committed to the repository:

```sh
npx wrangler secret put JWT_SECRET
```

In the Cloudflare Dashboard, the equivalent location is the Worker’s `Variables & Secrets` panel.

### Frontend Pages deployment

The frontend is configured as a Cloudflare Pages target in `apps/web/wrangler.jsonc`, with output directed to the SvelteKit Cloudflare build directory.

Production builds are produced from the repository root with Turbo:

```sh
npx turbo run build --filter=web
```

The Pages integration should point at the `apps/web` workspace and use the generated SvelteKit Cloudflare output (`.svelte-kit/cloudflare`).

### Deployment notes

- Keep `PUBLIC_LOCAL_API` and `PUBLIC_PROD_API` aligned with the current environment before building the frontend.
- Keep `JWT_SECRET` out of version control for production. Use `.dev.vars` only for local API development.
- The backend and frontend both rely on the shared Hono route contract exported from `apps/api/src/index.ts` as `AppType`.

## Quality Gates and CI

The CI workflow in `.github/workflows/ci.yml` performs:

1. Install dependencies with `npm ci`
2. Lint the workspace with `npm run lint`
3. Run tests with `npm run test`
4. Build the workspace with `npm run build`

These checks mirror the local workflow and are intended to catch broken route contracts, formatting drift, and build regressions before merge.

## Implementation Notes

- The backend auth middleware validates `Authorization: Bearer ...` tokens against the typed Cloudflare binding `JWT_SECRET`.
- The frontend uses role-aware route guards and client-side redirects in the Svelte layouts to keep the UX aligned with backend authorization.
- The instructor dashboard and admin queue both operate as browser-driven client views backed by Hono RPC calls.
- The student portal is centered around the root route and the course catalog route, with the login page at `/login`.

## Repository Maintenance

- Keep route additions in `apps/api/src/routes/` and export them from `apps/api/src/index.ts` so `AppType` stays accurate.
- Update `apps/web/src/lib/api/client.ts` whenever backend routes change so the typed RPC client stays in sync.
- Prefer `npm run format` before `npm run lint` when you want Prettier to rewrite files.
