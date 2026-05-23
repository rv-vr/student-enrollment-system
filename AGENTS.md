## Project Configuration

- **Architecture**: Turborepo Monorepo (npm workspaces)
- **Language**: TypeScript (Strict)
- **Frontend**: SvelteKit (Configured as a pure Client-Side SPA) inside `./apps/web`
- **Backend**: Hono.dev (Targeting Cloudflare Workers) inside `./apps/api`
- **Add-ons**: Svelte MCP Server, Hono Docs MCP Server

---

## Architectural Rules (Strictly Enforced)

1. **Strict Separation**: The frontend (`./apps/web`) is a decoupled SPA. Never write database queries, server-side actions, or `+page.server.ts` files. All data must be fetched via HTTP from the Hono backend.
2. **End-to-End Type Safety (Hono RPC)**: The Hono app exports its route type definition (`export type AppType = typeof routes`) from its main entry point. The Svelte app consumes this by referencing the workspace dependency (`import type { AppType } from 'api'`) and initializing the client via `hc<AppType>()`. When creating or updating backend routes, always ensure the types are properly exported so the frontend client stays in sync.
3. **Path Awareness**: You are running at the root of a monorepo.
   - Svelte source code is located in `./apps/web/src`
   - Hono source code is located in `./apps/api/src` (Main entry point is `./apps/api/src/index.ts`)

---

## Turborepo & Workspace Rules (Strictly Enforced)

1. **Root-Level Execution**: Always run execution, testing, and build commands from the repository root. Do not `cd` into `apps/web` or `apps/api` to run scripts unless explicitly forced by a tool limitation.
2. **Turbo Filtering Commands**: When running tasks for a specific app, use Turborepo's `--filter` flag from the root directory:
   - To build the backend: `npx turbo run build --filter=api`
   - To run the frontend dev server: `npx turbo run dev --filter=web`
   - To test the whole workspace: `npx turbo run test`
3. **Dependency Isolation**:
   - Never add frontend or backend application dependencies to the root `package.json`.
   - Frontend packages (e.g., UI libraries) belong in `./apps/web/package.json`.
   - Backend packages (e.g., Zod, Hono middleware) belong in `./apps/api/package.json`.
4. **Local Workspace Syncing**: If you add a new route type export in the Hono API, you must trigger a workspace refresh or run a build task (`npx turbo run build --filter=api`) so the Svelte frontend can pick up the updated TypeScript types through the `workspace:*` linking protocol.

---

## Available Svelte MCP Tools & Workspace Context:

You have access to the Svelte MCP server for comprehensive Svelte 5 and SvelteKit documentation. Use the tools below with the following monorepo adjustments. If a tool fails or returns incomplete results, retry once; if it still fails, notify the user and provide a clear fallback or manual guidance.

### 1. list-sections

Use this **FIRST** for any Svelte-related tasks to discover available Svelte 5/SvelteKit documentation sections. Returns titles, use cases, and paths. If the task is not Svelte-related, this step is optional.

### 2. get-documentation

Retrieves full documentation content for specific sections. After using `list-sections`, analyze the `use_cases` field and fetch all relevant Svelte 5 documentation chunks required for the user's prompt.

### 3. svelte-autofixer

Analyzes Svelte code and returns issues/suggestions.

- **Monorepo Constraint**: When reading, writing, or fixing Svelte code, target the correct subdirectory: `./apps/web/src/...`
- **Requirement**: You MUST run this tool on any Svelte code you write before presenting it to the user. Repeat until no errors remain. If the tool returns errors it cannot fix, report them and suggest manual fixes to the user.

### 4. playground-link

Generates a Svelte 5 Playground link. Only offer this if you are prototyping standalone UI components; do not use it for code intended directly for the monorepo files.

**Execution notes:** Group related constraints and follow them in sequence: (1) verify task is Svelte-related, (2) run `list-sections`, (3) fetch docs with `get-documentation`, (4) run `svelte-autofixer` on any new/edited Svelte files, (5) offer `playground-link` only for standalone prototypes.

### 5. hono-docs (Remote HTTP Tool)

Provides deep, version-specific knowledge regarding the Hono framework architecture.

- **query**: Use this tool to search across Hono's routing API, middleware parameters, context object helpers (`c.json`, `c.req`), and Cloudflare Worker bindings.
- **docs**: Use this to pull down full documentation chapters when building complex router setups or debugging TypeScript RPC issues.

---

## Unified Execution Workflow for Features

When implementing a full-stack feature (e.g., implementing Course enrollment limits):

1. **Research & Backend**: First, use `hono-docs` to cross-reference the best middleware or validation schemas (like `zValidator`). Build the endpoints inside `./apps/api/src`.
2. **Type Generation**: Ensure the Hono router exports its updated types so the local workspace link updates.
3. **Frontend**: Use the Svelte MCP tools (`list-sections`, `get-documentation`) to design client-side components inside `./apps/web/src` that call the updated Hono RPC backend safely.

---

## Contextual Instructions for the Agent

- When asked to create a new feature (e.g., "Add course dropping functionality"):
  1. First, create or modify the endpoint in `./apps/api/src/...` using Hono.
  2. Ensure the Hono router exports its updated types.
  3. Modify the Svelte component or load function in `./apps/web/src/routes/...` utilizing Hono's type-safe RPC client (`hc`) to talk to that new endpoint.
