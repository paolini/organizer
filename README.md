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

## Authentication (local, no DB)

This project includes a minimal, file-backed authentication system used to protect the MP3 APIs. It is intended for local development and prototypes only.

- Where users are stored: `data/users.json` (array of user objects `{ id, username, password }`). Passwords are hashed with `bcryptjs`.
- JWT: signed with `AUTH_SECRET` environment variable (defaults to a development secret if unset). The API sets an HTTP-only cookie named `token` on successful login.

Authentication summary (admin/config):

- Users are stored in `data/users.json` (local JSON file). Passwords are hashed with `bcryptjs`.
- Authentication uses JWTs signed with the `AUTH_SECRET` environment variable and delivered as an HTTP-only cookie named `token`.


Environment variables (development):

- `MP3_DIR` — path to the root folder containing your audio files. Example: `/home/you/mp3`.
- `AUTH_SECRET` — secret used to sign JWTs. Replace the default for any non-dev usage.

Quick start (local auth + files):

```bash
export MP3_DIR=/path/to/your/mp3s
export AUTH_SECRET='replace_with_secure_secret'
rm -rf .next
npm run dev
```

Create users via the signup API (recommended):

The preferred and supported way to create users for this app is to call the signup endpoint. This ensures the password is hashed using `bcrypt` in the correct format the server expects.

Example (generate bcrypt hash with `htpasswd`):

```bash
# install on Debian/Ubuntu: sudo apt install apache2-utils
# generate bcrypt hash for user 'alice' (cost 10) and print only the hash
htpasswd -bnBC 10 alice 's3cret' | cut -d: -f2
```

Paste the resulting `$2b$...` hash into `data/users.json` under the user's `password` field, or use the signup endpoint instead to create users programmatically.

If you prefer to add users manually to `data/users.json`, make sure the password is a bcrypt hash (starts with `$2b$` or `$2a$`). Other hash formats (for example OpenSSL's `$6$` SHA-512 crypt) will NOT work with the current authentication code.

Permissions

- Users include a `permissions` array in `data/users.json`, for example: `"permissions": ["read"]` or `"permissions": ["read","write"]`.
- New users created via the `signup` endpoint get an empty `permissions` array by default and therefore cannot access protected MP3 APIs until an admin grants them permissions.
- To grant permissions manually, edit `data/users.json` and add the desired permissions to the user object, or implement an admin UI later.

If you need to generate a bcrypt hash locally, use one of the alternatives below (htpasswd / Python / Node) and paste the resulting `$2b$...` hash into `data/users.json`.

Notes & security:

- This setup is NOT suitable for production — passwords and user data are stored in a local JSON file and there is no rate-limiting, CSRF protection, or hardened cookie policy configured for cross-site contexts.
- For production, migrate `data/users.json` to a proper database, use HTTPS, rotate `AUTH_SECRET`, implement refresh tokens or shorter expirations, and harden cookie settings (`SameSite`, `Secure`, CSRF tokens).

