This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Assignment #4: photo → AI caption → feed → vote

Signed-in users upload a photo, Gemini (server-side, image attached) writes a
funny caption, and the post (photo, instruction, caption, model) is saved and
shown in `/feed`, where signed-in users up/downvote it and delete their own.

### Environment (`.env.local`, see `.env.example`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`
(server-only; never exposed to the browser).

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

The final state after step 3 is the one the app expects. RLS is enabled on
every table (`books`, `profiles`, `generations`, `votes`); users can only read
or change their own `profiles`, `generations` (insert/delete) and `votes`.
The shared feed and vote totals come from the `SECURITY DEFINER` function
`feed_generations()`, which only returns data to signed-in users.

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
