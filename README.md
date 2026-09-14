# Capstone

A full stack web app with a React (Vite) frontend, an Express API, and a SQLite database.

## Project structure

```
Capstone/
├── package.json          # root: npm workspaces + scripts that run both apps
├── client/               # React frontend (Vite)
│   ├── index.html
│   ├── vite.config.js    # proxies /api to the server during development
│   ├── public/           # static assets served as-is
│   └── src/
│       ├── main.jsx      # entry point
│       ├── App.jsx       # root component
│       ├── components/   # reusable UI components
│       ├── pages/        # page-level components
│       ├── services/     # API calls (fetch wrappers)
│       ├── hooks/        # custom React hooks
│       └── styles/       # global CSS
└── server/               # Express API
    ├── .env.example
    ├── data/             # SQLite database file (git-ignored)
    └── src/
        ├── index.js      # starts the server
        ├── app.js        # Express app + middleware
        ├── config/       # environment config
        ├── db/           # connection, schema, seed script
        ├── routes/       # URL -> controller mapping
        ├── controllers/  # request handling
        ├── models/       # database queries
        └── middleware/   # error handling, auth, etc.
```

## Requirements

- Node.js **22.13 or newer**. The server uses Node's built-in `node:sqlite` module, so there are no native database packages to compile.

Install it from https://nodejs.org or with Homebrew: `brew install node`.

## Getting started

```bash
npm install                            # installs client + server dependencies
cp server/.env.example server/.env     # create your local env file
npm run db:seed                        # optional: add sample data
npm run dev                            # runs the API and the frontend together
```

- Frontend: http://localhost:5173
- API: http://localhost:3001/api/health

## Scripts

| Command           | What it does                                        |
| ----------------- | --------------------------------------------------- |
| `npm run dev`     | Starts the server (with auto-reload) and Vite       |
| `npm run build`   | Builds the frontend into `client/dist`              |
| `npm start`       | Runs the server; serves `client/dist` if it exists  |
| `npm run db:seed` | Inserts sample rows into the database               |

## Adding a feature (example flow)

1. Add a table to `server/src/db/schema.sql`.
2. Write queries in `server/src/models/`.
3. Handle requests in `server/src/controllers/`.
4. Register the endpoints in `server/src/routes/` and mount them in `routes/index.js`.
5. Call the endpoint from `client/src/services/api.js`.
6. Show the data in a component under `client/src/pages/` or `client/src/components/`.
