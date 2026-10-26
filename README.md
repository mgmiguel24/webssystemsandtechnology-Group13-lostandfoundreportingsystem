# Lost and Found Reporting System

Lost and Found Reporting System (internally named "FindMe") is a lost-and-found reporting app with an Express.js API, a browser interface, and a SQLite database. Users can report and search for lost or found persons, pets, and items, update their own reports, and view contact details on reports when signed in. Administrators can manage report status and user roles.

**Live deployment:** `https://find-me-tx2o.onrender.com`
This runs on Render's free tier. The first request after a period of inactivity may take 30–50 seconds while the service wakes up. Without persistent storage attached, the database and uploaded photos reset to seeded sample data on redeploy or extended downtime.

## Features

- Account registration and login with bcrypt password hashing and JWT sessions in HTTP-only cookies.
- Server-side role and report ownership checks. New accounts are always regular users; an administrator must promote users.
- Create, view, edit, and search lost-and-found reports.
- Filter reports by type, category, status, or date range. The API also retains exact-date filtering for compatibility.
- Optional image upload with size limits and file-content validation.
- Report history for owners and administrators, including creation, edits, status changes, and deletion.
- Admin tools for listing users and changing roles, with protection against removing the last administrator.
- Rate limits for authentication and report creation.

## Requirements

- Node.js 20 or newer
- npm

## Run locally

From the `findme-api` directory:

```sh
npm install
```

Copy `.env.example` to `.env`, then set a strong `JWT_SECRET` and `ADMIN_PASSWORD`. Keep `.env` private and out of Git.

```sh
# Windows PowerShell
Copy-Item .env.example .env

# macOS or Linux
cp .env.example .env
```

Start the app and open `http://localhost:3000`:

```sh
npm start
```

The first start initializes `data/findme.db`, creates the configured administrator if the database has no users, and adds sample reports. The app stores uploaded photos under `uploads/` by default. The browser page is served by Express; opening `public/index.html` directly will not connect to the API.

## Environment settings

The main settings are documented in `.env.example`:

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port; Render provides this automatically when deployed there. |
| `JWT_SECRET` | Secret used to sign session tokens. Use a long, random value. |
| `SESSION_HOURS` | Session lifetime in hours. |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Initial administrator, created only when the database is empty. |
| `DB_PATH` | SQLite database file path. Defaults to `data/findme.db`. |
| `UPLOAD_DIR` | Directory for uploaded images. Defaults to `uploads`. |
| `MAX_UPLOAD_MB` | Maximum image upload size. |
| `AUTH_RATE_LIMIT` | Authentication requests allowed per IP in 15 minutes. |
| `REPORT_RATE_LIMIT` | Report submissions allowed per IP in 15 minutes; defaults to 10. |
| `CSP` | Set to `off` only when troubleshooting the content security policy. |
| `NODE_ENV` | Set to `production` in production deployments. |

## API

All endpoints are under `/api`.

| Method and path | Purpose | Access |
| --- | --- | --- |
| `POST /api/auth/register` | Register a regular account | Public |
| `POST /api/auth/login` | Sign in | Public |
| `POST /api/auth/logout` | Sign out | Public |
| `GET /api/auth/me` | Get the current session user | Public |
| `GET /api/reports` | Search and list reports | Public; contact is omitted |
| `GET /api/reports/:id` | Get report details | Public; contact for signed-in members, history for owner/admin |
| `POST /api/reports` | Create a report; optional `image` upload | Signed in |
| `PATCH /api/reports/:id` | Edit title, location, date, description, and contact | Owner or admin |
| `PATCH /api/reports/:id/status` | Resolve or reopen a report | Owner or admin |
| `DELETE /api/reports/:id` | Soft-delete a report and record the event | Admin |
| `GET /api/admin/users` | List users | Admin |
| `PATCH /api/admin/users/:id/role` | Promote or demote a user | Admin |

`GET /api/reports` accepts `q`, `type`, `category`, `status`, `date`, `dateFrom`, `dateTo`, `page`, and `limit`. `dateFrom` and `dateTo` are inclusive bounds and can be used separately or together. `date` continues to match one exact day.

## Run tests

```sh
npm test
```

The suite uses a temporary SQLite database and upload directory.

## Deploying on Render

Create a Web Service for this repository and set its Root Directory to `findme-api`. Use `npm install` as the build command and `npm start` as the start command. Set `NODE_ENV=production` and provide strong values for `JWT_SECRET` and `ADMIN_PASSWORD`; Render supplies `PORT`.

The default SQLite database and upload folders are local files. To preserve them across deploys, attach persistent storage and place both paths on its mount. For a disk mounted at `/var/data`, use:

```text
DB_PATH=/var/data/findme.db
UPLOAD_DIR=/var/data/uploads
```

## Project layout

```text
src/
  app.js
  server.js
  config/        Environment configuration
  controllers/   Request handling
  db/            SQLite initialization and seed data
  middleware/    Authentication, authorization, uploads, errors
  models/        Database queries
  routes/        API routes
  utils/         Validation and HTTP helpers
public/          Browser interface
tests/           API tests
data/            Local SQLite database
uploads/         Local uploaded images
```

## Troubleshooting

- If `npm install` fails while building `better-sqlite3` on Windows, install Visual Studio Build Tools with the C++ workload and a Windows SDK, then retry.
- If styling or icons do not load, check the network connection; the page uses Tailwind CSS and Phosphor Icons from CDNs.
- If deploying with SQLite or local image uploads, ensure both paths are on persistent storage.
