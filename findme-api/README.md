# FindMe Community Lost & Found Hub

Express.js backend and web front end for the Lost and Found Community Assistance System (MO-IT115).

## Run it on your computer

1. Install Node.js 20 or newer (LTS) from nodejs.org.
2. Open a terminal in this folder and run `npm install`.
3. Copy `.env.example` to `.env` (Windows: `copy .env.example .env`, macOS/Linux: `cp .env.example .env`).
4. Open `.env` and set `ADMIN_PASSWORD` and `JWT_SECRET` to your own values.
5. Run `npm start`.
6. Open http://localhost:3000 in Chrome.

Open the site through http://localhost:3000. Double-clicking `public/index.html` will not work, because the page now gets its data from the server.

The first start creates `data/findme.db`, the admin account from `.env`, and two sample reports. To start over with an empty system, stop the server and delete `data/findme.db`.

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Runs the website and API |
| `npm run dev` | Same, restarting automatically when a file changes |
| `npm test` | Runs the 14 automated API tests on a throwaway database |

## API

| Method and path | Purpose | Who can use it |
| --- | --- | --- |
| POST /api/auth/register | Create a regular account | Anyone |
| POST /api/auth/login | Sign in | Anyone |
| POST /api/auth/logout | Sign out | Anyone |
| GET /api/auth/me | Current signed-in user | Anyone |
| GET /api/reports | List and filter (`q`, `type`, `category`, `status`, `date`, `page`, `limit`) | Anyone, contact hidden |
| GET /api/reports/:id | One report; contact for members, history for owner or admin | Anyone |
| POST /api/reports | Create a report (form data, optional `image`) | Signed in |
| PATCH /api/reports/:id/status | `{ "status": "Resolved" }` or `"Active"` | Owner or admin |
| DELETE /api/reports/:id | Remove a report (kept in the database for the audit trail) | Admin |
| GET /api/admin/users | List users | Admin |
| PATCH /api/admin/users/:id/role | `{ "role": "admin" }` or `"user"` | Admin |

## Folder layout

```
src/
  server.js            starts the server
  app.js               security headers, routes, static files
  config/env.js        settings from .env
  db/index.js          tables and first-run seed (SQLite)
  models/              database queries
  controllers/         request handling
  routes/              URL to controller mapping
  middleware/          sign-in, roles, uploads, errors
  utils/               validation rules and helpers
public/index.html      the web page
uploads/               uploaded photos
data/                  the database file
tests/api.test.js      automated tests
```

