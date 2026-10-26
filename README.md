This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## What this app is

**caption**: pick a photo and a comedic voice, get three real AI captions, remix
your favorite, then publish it.

- **Studio** (`/` and `/studio`): upload a photo or pick one from the library, choose a
  voice, get three takes, switch between them, remix (Shorter / Sharper / Weirder /
  Pun it / Dramatic), shuffle, copy, download a share card, publish. **Generating and
  publishing are separate.** Visitors can generate without signing in (server-enforced
  quota); publishing, remixing, voting and saving need a Google sign-in.
- **Arena** (`/arena`): two captions, one photo (same library image whenever possible).
  Pick the funnier one, then see who wrote each and the real tallies.
- **Daily Drop** (`/drop`): one library photo per day (deterministic from the date, or pinned
  by an admin), America/New_York clock. Caption it, vote on others (not your own),
  yesterday's winner is shown (only with a positive score).
- **Hall of Fame** (`/hall`), **Feed** (`/feed`, voice filter, "Surprise me", share
  cards), **My captions** (`/dashboard`), public caption pages (`/c/[id]`).

### Privacy model

Every post stays members-only. A post is visible to logged-out visitors only if its author
ticked **Also share publicly** when publishing (`generations.is_public`, default false;
a public copy of the image goes into the `shared-images` bucket). Nothing in any
migration makes an existing post public. The homepage wall and `/c/[id]` read only those
posts, through `SECURITY DEFINER` functions.

### AI usage and quotas

All Gemini calls are server-side (`src/lib/gemini.ts`) and each is preceded by a database
quota check (`src/lib/quota.ts`): a per-visitor and a global guest budget, plus a per-user
and a global ceiling for members. Visitors are identified by a salted hash of their network
address (IPv6 by /64); the raw IP is never stored. Both the guest and the member check need a shared secret
(`GUEST_QUOTA_SECRET`) so only this server can spend the budget, and **fail closed** without it. Off Vercel, set `TRUSTED_IP_HEADER` to your host's real-client-IP header (client-settable headers are ignored). Limits are rows in
`private.app_settings` and can be changed in the SQL editor.

### Environment (`.env.local`, see `.env.example`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY` and
`GUEST_QUOTA_SECRET` (both server-only; never exposed to the browser). The secret must be
24+ random characters and identical to the `quota_secret` row you store in the database
(migration 004, section 8).

### Database setup: run these in the Supabase SQL editor, in this order

1. `supabase/schema.sql`: `books`, `profiles` (+ signup trigger), the `avatars`
   bucket, and the first version of `generations`, `votes` and
   `feed_generations()`, all with RLS enabled.
2. `supabase/migrations/002_photo_captions.sql`: adds `image_path` / `model` to
   `generations`, the private `post-images` bucket and its Storage policies,
   the final `feed_generations()`, and the `books` policy fix for signed-in
   users. On a fresh project there are no old rows, so also run the commented
   PART 3 statements at the bottom of the file (`set not null`).
3. `supabase/migrations/003_delete_own_posts.sql`: lets users delete only their
   own generations and their own `post-images` files (votes cascade).

The `books` table comes from an early course assignment. The app no longer has
a Books page and nothing reads the table, but it is deliberately left in the
database (and in the historical SQL above) rather than dropped.

4. `supabase/migrations/004_studio_arena_drop.sql` (after the admin app's `001`): quotas,
   voices, sharing, Daily Drop, Arena, Hall of Fame, the public `shared-images` bucket. Read
   the header, run it once, then run the `quota_secret` statement from its section 8.
   The app degrades gracefully until it is applied (pages show a setup notice; guest
   generation refuses), but the Studio's quota check needs it.

5. `supabase/migrations/005_generation_log.sql` (Homework 7; after 004 and the admin's `002`):
   LLM providers/models (seeded with Google + Gemini) and the generation log. After each real
   Studio AI call the server records one request and one response row (typed direction,
   voice, image name, model, status, timing, caption text; **no image, no IP address, no
   secret**) through a secret-gated function. Only superadmins can read the log. Logging
   is best effort and never blocks a caption.

The final state after step 5 is the one the app expects. RLS is enabled on
every table (`profiles`, `generations`, `votes`, and the unused `books`); users can only read
or change their own `profiles`, `generations` (insert/delete) and `votes`.
The shared feed and vote totals come from the `SECURITY DEFINER` function
`feed_generations()`, which only returns data to signed-in users.

## Tests

```bash
npm test          # pure logic: Drop clock, quota keys, parsing, redirects (no network)
```

SQL tests (privacy, quotas, voting integrity, Drop and Arena rules) run the real migrations
on a throw-away in-memory Postgres and never touch Supabase:

```bash
npm i --no-save @electric-sql/pglite
node supabase/tests/sql/studio_arena_drop.test.mjs
node supabase/tests/sql/admin_studio.test.mjs     # needs ../HelloWorld-Admin
node supabase/tests/sql/homework7.test.mjs        # providers/models/log + admin config tables
```

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
