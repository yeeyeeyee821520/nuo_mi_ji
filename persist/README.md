Persistent mock API for YourApp (nuo_mi_ji)

This Express server uses SQLite (better-sqlite3) to persist data across restarts. It implements the same API contract expected by src/YourApp.tsx but stores items, comments, profile, and messages in a local SQLite database.

Quick start:

1. Install dependencies:

   cd persist
   npm install

2. Start server:

   npm start

3. By default the server listens on port 4001. You can change it with PORT environment variable.

Data:
- Database file is located at persist/data/app.db
- Uploaded files are saved to persist/uploads and served at /uploads/<filename>

API endpoints implemented:
- GET /api/feed?cursor=&filter=all|local&type=video|image
- GET /api/search?q=
- POST /api/item/:id/like
- POST /api/item/:id/comment  (JSON body { text })
- GET /api/profile
- PUT /api/profile  (multipart form: avatar file + name)
- POST /api/upload  (multipart form: file + optional title)
- GET /api/profile/favorites
- GET /api/profile/works
- GET /api/messages
- POST /api/messages  (JSON body { text })

Notes and differences from in-memory mock:
- likes/liked are stored per-item. There's no multi-user like tracking (no auth) — liked acts as a boolean for the single demo user.
- The server seeds example items on first run if the items table is empty.

How to use with YourApp front-end:
- Run this server and point YourApp apiConfig to it, for example:

  const apiConfig = {
    feed: 'http://localhost:4001/api/feed',
    search: 'http://localhost:4001/api/search',
    like: (id) => `http://localhost:4001/api/item/${id}/like`,
    comment: (id) => `http://localhost:4001/api/item/${id}/comment`,
    profile: 'http://localhost:4001/api/profile',
    upload: 'http://localhost:4001/api/upload',
    favorites: 'http://localhost:4001/api/profile/favorites',
    works: 'http://localhost:4001/api/profile/works',
    messages: 'http://localhost:4001/api/messages',
  };

  <YourApp apiConfig={apiConfig} />

Persistence:
- Data is persisted in persist/data/app.db. You can inspect it with any SQLite viewer.

If you want, I can:
- Add authentication (JWT + users table) so likes/comments are tracked per user.
- Add migrations or an admin script to reset/seed data.
- Add Dockerfile to containerize the server.
