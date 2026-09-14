# ThesisTrack: Thesis Management System

A full stack web app for managing student theses from proposal to final manuscript. It has three roles, each with its own dashboard and permissions.

**Stack:** React (Vite) · Express · SQLite (Node's built-in `node:sqlite`) · JWT auth · file uploads with multer

## Getting started

Requires **Node.js 22.13 or newer** (`brew install node`).

```bash
npm install                            # install client + server dependencies
cp server/.env.example server/.env     # create your local env file
npm run db:seed                        # create the database with demo data
npm run dev                            # run the API and the website together
```

Open http://localhost:5173. The API runs at http://localhost:3001/api.

### Demo accounts

Every seeded account uses the password **`password123`**. In development, the login page has buttons that fill these in.

| Role    | Email                  | What you'll see                                               |
| ------- | ---------------------- | ------------------------------------------------------------- |
| Admin   | `admin@tms.edu`        | System stats, one thesis without an adviser, user management   |
| Adviser | `maria.santos@tms.edu` | Two advisees, one submission waiting for review               |
| Adviser | `jose.reyes@tms.edu`   | One completed thesis                                          |
| Student | `ana.cruz@tms.edu`     | Two stages approved, Chapters 4–5 under review                |
| Student | `ben.lim@tms.edu`      | Proposal returned with revisions requested                    |
| Student | `david.tan@tms.edu`    | Proposal submitted, no adviser assigned yet                   |
| Student | `ella.garcia@tms.edu`  | New student with no thesis yet                                |

Run `npm run db:seed` any time to reset the database and delete uploaded files.

## Roles and permissions

All permissions are enforced by the API, not only hidden in the UI.

| Action                                          | Student          | Adviser             | Admin |
| ----------------------------------------------- | ---------------- | ------------------- | ----- |
| Register publicly                               | ✅               | Created by admin    | Created by admin |
| Create a thesis (one per student)               | ✅               | —                   | —     |
| View theses                                     | Own only         | Assigned only       | All   |
| Edit thesis title, abstract, keywords           | Own, until completed | —               | ✅    |
| Upload a submission (PDF/DOC/DOCX, 20 MB)       | Own thesis       | —                   | —     |
| Download submission files                       | Own              | Assigned            | All   |
| Approve or request revisions                    | —                | Assigned            | ✅    |
| Comment on submissions                          | Own              | Assigned            | ✅    |
| Assign advisers, override status, delete thesis | —                | —                   | ✅    |
| Create, edit, deactivate, and delete users      | —                | —                   | ✅    |

### Thesis workflow

A thesis moves through four stages: **Proposal → Chapters 1–3 → Chapters 4–5 → Final Manuscript**.

1. The student uploads a manuscript for a stage. The thesis becomes **Under review**. Only one submission can be pending at a time.
2. The adviser either **approves** it or **requests revisions**. Requesting revisions requires written feedback.
3. After revisions are requested, the thesis shows **Needs revisions** and the student uploads a new version of that stage.
4. After an approval, the thesis is **In progress** and the student moves on to the next stage.
5. Once the Final Manuscript is approved, the thesis is **Completed**.

## Project structure

```
Capstone/
├── client/                     # React website (Vite)
│   └── src/
│       ├── App.jsx             # routes, with role guards
│       ├── context/            # AuthContext: login state and token
│       ├── services/api.js     # every API call
│       ├── hooks/useApi.js     # loading/error state for API calls
│       ├── components/
│       │   ├── layout/         # sidebar and top bar
│       │   ├── auth/           # route guards
│       │   ├── thesis/         # thesis form, upload form, admin controls
│       │   └── ui/             # badges, modals, stat cards, stage tracker, etc.
│       ├── pages/
│       │   ├── auth/           # login, register
│       │   ├── student/        # student dashboard, my thesis
│       │   ├── adviser/        # adviser dashboard
│       │   ├── admin/          # admin dashboard, user management
│       │   └── *.jsx           # shared pages: thesis list/detail, submission, profile
│       └── styles/index.css    # design tokens and all styles
└── server/                     # Express API
    ├── data/                   # SQLite database (git-ignored)
    ├── uploads/                # uploaded manuscripts (git-ignored)
    └── src/
        ├── db/                 # connection, schema.sql, seed.js
        ├── routes/             # URL → controller, with role middleware
        ├── controllers/        # request handling and validation
        ├── models/             # SQL queries
        ├── services/access.js  # who can see which thesis
        ├── middleware/         # auth, uploads, errors
        └── utils/              # passwords, validation, files
```

## API overview

| Method | Endpoint                          | Who                       |
| ------ | --------------------------------- | ------------------------- |
| POST   | `/api/auth/register`, `/api/auth/login` | Public               |
| GET/PATCH | `/api/auth/me`                 | Signed in                 |
| GET    | `/api/dashboard`                  | Signed in (role-specific) |
| GET    | `/api/theses`, `/api/theses/:id`  | Signed in (scoped)        |
| POST   | `/api/theses`                     | Student                   |
| PATCH  | `/api/theses/:id`                 | Student (own), Admin      |
| PATCH  | `/api/theses/:id/adviser`, `/status` · DELETE `/api/theses/:id` | Admin |
| POST   | `/api/theses/:id/submissions`     | Student (own)             |
| GET    | `/api/submissions/:id`, `/file`   | Anyone with thesis access |
| POST   | `/api/submissions/:id/comments`   | Anyone with thesis access |
| PATCH  | `/api/submissions/:id/review`     | Assigned adviser, Admin   |
| *      | `/api/users`, `/api/users/advisers` | Admin                   |

## Scripts

| Command           | What it does                                          |
| ----------------- | ----------------------------------------------------- |
| `npm run dev`     | Starts the API (auto-reload) and the Vite dev server  |
| `npm run build`   | Builds the website into `client/dist`                 |
| `npm start`       | Runs the API and serves `client/dist` if it exists    |
| `npm run db:seed` | Resets the database and uploads, then loads demo data |

## Production notes

- Set `NODE_ENV=production` and a long random `JWT_SECRET` in `server/.env`. The server refuses to start in production without one.
- Run `npm run build`, then `npm start`. Express serves the website and the API from one port.
