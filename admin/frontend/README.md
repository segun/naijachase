# NaijaChase administration frontend

This is a standalone Svelte application. It has its own dependency lock, build, and host; it imports no game frontend code. All requests use the current origin's `/admin-api/v1` routes and a separate HttpOnly admin session cookie.

Use Node.js 22.18 or newer and pnpm 11 or newer:

```sh
cd admin/frontend
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open `http://127.0.0.1:4174`. The admin backend must allow that exact development origin. `ADMIN_API_TARGET` changes the local proxy target (default `http://127.0.0.1:8081`); no backend credentials belong in a frontend environment file.

```sh
pnpm check
pnpm test
pnpm build
```

The production output is `dist/`, served at the root of a dedicated admin hostname with `/admin-api` proxied to the admin backend. Deploy the frontend and backend from the same release. See [`../../docs/admin.md`](../../docs/admin.md) for service configuration and reporting definitions.

The dashboard intentionally distinguishes opted-in browser traffic and registration drafts from all-account statistics. It does not calculate conversion percentages across these different cohorts. Missing metrics are displayed as unavailable; a failed refresh retains the previous snapshot with a stale warning. Background tabs pause automatic refresh. Registration records contain authorized email data and are not persisted in browser storage or exported.
