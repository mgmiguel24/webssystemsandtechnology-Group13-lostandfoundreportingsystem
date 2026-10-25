# Community Lost & Found Hub: Project Documentation

FindMe is a single-file HTML app (lostandfundcommunitysystem.html) with no real backend: every "backend" feature is simulated in the browser with localStorage, so data lives only on one device and none of the access rules are enforced.

## 1. Backend-Supported Features Analysis

The table lists each feature, how the prototype handles it today, and what a real backend must take over.

| Feature                           | Current implementation                                                                    | Production backend responsibility                                                                     |
| --------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| User registration                 | Pushes a user object into users, saved under findme_users                                 | Create account via API; hash passwords (bcrypt/argon2); verify email; enforce unique email            |
| Login and session                 | Matches email and plain-text password in the client; stores the profile in findme_session | Server-side authentication; issue a signed token (JWT) or HTTP-only session cookie; expiry and logout |
| Roles (user / admin)              | Role is a field on the user and is chosen in a dropdown at sign-up                        | Role assigned only by the server; admin accounts created or promoted by an existing admin             |
| Create report                     | Builds an object with Date.now() as id; saved under findme_reports                        | POST /reports with validation; database-generated id; reporter taken from the token, not the form     |
| Read and list reports             | Whole array is loaded into memory on page load                                            | GET /reports with pagination and server-side filters                                                  |
| Search and filter                 | Client-side filter() on title, description, location, type, category, status, exact date  | Database queries with indexes; full-text search; date range instead of exact date                     |
| Status change (Active / Resolved) | Allowed if user is admin or the reporter, checked in JavaScript                           | PATCH /reports/:id/status; server verifies ownership or admin role                                    |
| Delete report                     | Admin-only check in JavaScript, then array filter                                         | DELETE /reports/:id restricted to admins; optionally soft-delete with an audit trail                  |
| Photo upload                      | Converted to a base64 data URL and stored inside the report in localStorage               | Upload to object storage (S3 or similar); store only the URL; limit size and type; scan files         |
| Contact information               | Shown to every visitor in the detail modal                                                | Reveal only to signed-in users, or relay messages through the platform                                |
| Dark mode                         | Class toggle, not saved                                                                   | Optional: store as a user preference; otherwise keep in localStorage                                  |

### What is already backend-ready

- Reports have a stable shape (type, category, title, location, date, description, contact, status, reporter fields, image) that maps directly to a database table.
- Permission logic is isolated in a few functions (viewDetails, toggleReportStatus, deleteReport), so each can be swapped for an API call.
- Output is escaped with escapeHtml() before it is inserted into the page.

### Why the current setup cannot be treated as secure

- Passwords are stored in plain text, and the two seeded demo accounts have published credentials.
- Anyone can register as "System Administrator" from the sign-up form.
- All permission checks run in the browser, so editing localStorage in developer tools bypasses them.
- Base64 photos fill the roughly 5 MB localStorage quota quickly; a failed save will throw.

### Suggested API surface

| Endpoint                  | Purpose                                                       | Access                  |
| ------------------------- | ------------------------------------------------------------- | ----------------------- |
| POST /auth/register       | Create a regular user account                                 | Public                  |
| POST /auth/login          | Return token or session cookie                                | Public                  |
| POST /auth/logout         | End the session                                               | Signed in               |
| GET /reports              | List with q, type, category, status, date and page parameters | Public (contact hidden) |
| GET /reports/:id          | Full detail including contact                                 | Signed in               |
| POST /reports             | Create a report with image upload                             | Signed in               |
| PATCH /reports/:id/status | Resolve or reopen                                             | Owner or admin          |
| DELETE /reports/:id       | Remove a report                                               | Admin                   |

### Express.js implementation plan

Express.js is the target backend: it would serve the REST API above, enforce authentication and roles in middleware, and replace every localStorage read and write in the page. The database is not yet chosen; PostgreSQL or SQLite fits the report structure well, and the middleware below does not depend on it.

| Concern           | Express.js approach                                                              | Replaces in the prototype                           |
| ----------------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
| Routing           | express.Router() modules: auth.routes.js, reports.routes.js                      | The functions that read and write users and reports |
| Password security | bcrypt hash on register, compare on login                                        | Plain-text match in handleLoginSubmit               |
| Sessions          | jsonwebtoken signed token in an HTTP-only cookie, checked by requireAuth         | findme_session in localStorage                      |
| Roles             | requireRole('admin') and ownerOrAdmin middleware                                 | Role checks inside viewDetails and deleteReport     |
| Validation        | zod or express-validator on every request body                                   | HTML required attributes only                       |
| Photo upload      | multer with file size and MIME type limits; files saved to disk or cloud storage | Base64 data URL in the report object                |
| Hardening         | helmet, cors limited to the front-end origin, express-rate-limit on /auth/\*     | None                                                |
| Errors            | One error-handling middleware returning JSON and status codes                    | alert() calls                                       |

#### Suggested project structure

findme-api/\
  src/\
    app.js\
    server.js\
    config/env.js\
    middleware/auth.js\
    middleware/upload.js\
    middleware/errorHandler.js\
    routes/auth.routes.js\
    routes/reports.routes.js\
    controllers/\
    models/\
  uploads/\
  .env\
  package.json

#### Core middleware (sketch)

// middleware/auth.js\
const jwt = require('jsonwebtoken');\
\
function requireAuth(req, res, next) {\
  const token = req.cookies.token;\
  if (!token) return res.status(401).json({ error: 'Sign in required' });\
  try {\
    req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, email, role }\
    next();\
  } catch {\
    res.status(401).json({ error: 'Invalid or expired session' });\
  }\
}\
\
function requireRole(role) {\
  return (req, res, next) =>\
    req.user.role === role ? next() : res.status(403).json({ error: 'Not allowed' });\
}\
\
module.exports = { requireAuth, requireRole };



// routes/reports.routes.js (excerpt)\
router.get('/', listReports);                              // public, contact hidden\
router.get('/:id', requireAuth, getReport);                // includes contact\
router.post('/', requireAuth, upload.single('image'), createReport);\
router.patch('/:id/status', requireAuth, ownerOrAdmin, toggleStatus);\
router.delete('/:id', requireAuth, requireRole('admin'), deleteReport);

#### Front-end changes needed

| Prototype function                      | Becomes                                                                            |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| handleRegisterSubmit, handleLoginSubmit | fetch('/api/auth/register') and fetch('/api/auth/login'); remove the role dropdown |
| handleLogout                            | fetch('/api/auth/logout')                                                          |
| filterReports                           | fetch('/api/reports?q=...&type=...'), with filtering done by the database          |
| handleReportSubmit                      | fetch('/api/reports', { method: 'POST', body: FormData })                          |
| toggleReportStatus, deleteReport        | PATCH and DELETE calls; update the grid from the response                          |
| saveData                                | Removed                                                                            |

## 2. Implementation Updates and Revisions

The current build delivers a working front end for reporting, browsing, and moderating lost and found cases; the revisions below close the gaps found when reading the code. This section is based on the single file supplied, not on a version history.

### Implemented in the current build

- Responsive card grid (1 to 4 columns) built with Tailwind CSS, with Phosphor icons and a sticky header.
- Light and dark theme toggle.
- Registration, login, logout, and a header badge showing name and role.
- Report form with type (Lost / Found), category (Person / Pet / Item), location, date, description, contact, and optional photo with live preview.
- Search box plus four filters (type, category, status, date) and a reset on logo click.
- Detail modal with Mark as Resolved / Reopen for the owner or an admin, and Delete for admins only.
- Two seeded reports and two seeded accounts for demonstration.

### Issues found and recommended revisions

| Priority | Issue                                                                                                | Where                                                                                                                             | Recommended revision                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| High     | Anyone can create an admin account                                                                   | Role dropdown in the register form and handleRegisterSubmit                                                                       | Remove the dropdown; always register as user; promote admins on the server                   |
| High     | Passwords stored and compared in plain text                                                          | users array, handleLoginSubmit                                                                                                    | Move authentication to a backend with hashed passwords                                       |
| High     | Contact details of people and pets visible to all visitors                                           | viewDetails                                                                                                                       | Show contact only to signed-in users, or use in-app messaging                                |
| Medium   | Dark mode may not restyle the page background                                                        | toggleDarkMode adds dark to body, but Tailwind's class variant styles descendants, so body's own dark: classes are likely ignored | Toggle the class on document.documentElement; verify in the browser                          |
| Medium   | Photo uploads can exceed the localStorage quota                                                      | handleReportSubmit stores base64                                                                                                  | Resize or compress before saving; wrap setItem in try/catch; use file storage with a backend |
| Medium   | Theme choice is lost on reload                                                                       | toggleDarkMode                                                                                                                    | Save the choice and apply it on load                                                         |
| Medium   | date and image are inserted into HTML without escaping                                               | renderReports, viewDetails                                                                                                        | Escape or set src through the DOM when data comes from a server                              |
| Low      | Registration re-renders the grid without active filters                                              | handleRegisterSubmit calls renderReports(reports)                                                                                 | Call filterReports() as login does                                                           |
| Low      | Date filter matches one exact day only                                                               | filterReports                                                                                                                     | Add a from / to range                                                                        |
| Low      | No edit option for a report, and no confirmation before status change                                | Detail modal                                                                                                                      | Add an edit form for the owner                                                               |
| Low      | Report date accepts future dates                                                                     | report-date input                                                                                                                 | Set max to today                                                                             |
| Low      | Footer and page copy use "Lost and Found Community Assistance System" while the header says "FindMe" | Header and footer                                                                                                                 | Pick one product name                                                                        |

### Suggested order of work

1. Fix the three high-priority items before any real user data is entered.
2. Replace localStorage with the API listed in section 1.
3. Apply the medium and low items during the migration.

## 3. Workflow Reflections

Building the interface first and simulating the backend in the browser let the whole user journey be tested quickly, but it also hid the security work that a real system needs. These reflections are inferred from the code's structure; add your own notes on schedule, tools, and teamwork where they differ.

### What worked well

- **Prototype-first approach.** A single HTML file with Tailwind and Phosphor loaded from CDNs needed no build step, so changes could be checked by refreshing the page.
- **One function per action.** Functions such as handleLoginSubmit, filterReports, and toggleReportStatus are small and documented with comments, which makes the later swap to API calls straightforward.
- **Seed data.** Demo users and two sample reports made every role and filter testable immediately.
- **Role-aware interface.** The "Your Post" and "Admin Access" badges make permissions visible, which helps testing and user understanding.

### What to do differently

- **Decide the security model before the interface.** The self-selected admin role and plain-text passwords are convenient for a demo but would have to be redone; defining roles first avoids rework.
- **Plan storage limits early.** Storing images as base64 in localStorage worked for two records but does not scale.
- **Test both themes and all roles.** The dark mode background issue and the filter reset after registration are the kind of defects a short checklist would catch.
- **Separate files.** Splitting HTML, CSS, and JavaScript would make review and version control easier once the project grows.

### Next steps

- ☐ Fix the three high-priority issues in section 2
- ☐ Set up the Express.js API (see the plan in section 1) and choose its database
- ☐ Replace localStorage calls with the API endpoints in section 1
- ☐ Write a test checklist covering guest, user, and admin flows in light and dark mode
- ☐ Decide how missing-person reports will be moderated and how contact details are protected
