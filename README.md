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

## Authentication and users

Users live in `data/users.json` (a JSON array; passwords are bcrypt hashes). Sessions are JWTs signed with `AUTH_SECRET`, stored in an HTTP-only cookie named `token` and valid for 7 days.

### Permissions

| Permission | Allows |
|---|---|
| `read`  | browse files and tags, download |
| `write` | edit tags and covers, upload, move, rename, delete, convert |
| `admin` | manage users (the **Utenti** page) |

### Managing users

- **First user**: on an installation with no users, `/signup` creates the first account with all permissions (`read`, `write`, `admin`).
- **Afterwards**, admins manage everything from the **Utenti** page (`/users`): create users, toggle permissions, reset passwords, delete users. An admin cannot remove their own `admin` permission or delete themselves, so at least one admin always remains.
- **Every user** can change their own password from the account page (`/account`).
- Changing or resetting a password logs out every other session of that user. Deleting a user ends their sessions immediately.
- Passwords must be at least 8 characters.

### Environment variables

- `TARGET_DIR` — root folder of the music library. Example: `/home/you/mp3`.
- `AUTH_SECRET` — secret used to sign session tokens. **Always set it in production.**
- `ALLOW_SIGNUP` — set to `true` to let anyone register from `/signup`. New accounts get no permissions until an admin enables them. Default: registration closed (except for the very first user).

### Security notes

- After 10 failed logins from the same IP within 15 minutes, further attempts from that IP are refused for the rest of the window. The client IP is read from `X-Forwarded-For`, so the app must run behind a reverse proxy that sets that header (such as Traefik).
- `data/users.json` contains password hashes: never commit it (it is in `.gitignore`).

### Recovering access manually

If no admin can log in, edit `data/users.json` directly: add `"admin"` to a user's `permissions`, or replace their `password` with a new bcrypt hash, for example:

```bash
node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 'new-password'
```

Changes to the file take effect immediately, without restarting.

## Local development

```bash
export TARGET_DIR=/path/to/your/mp3s
export AUTH_SECRET='replace_with_secure_secret'
npm run dev
```
