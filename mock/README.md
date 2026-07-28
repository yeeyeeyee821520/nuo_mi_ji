Mock API for YourApp (nuo_mi_ji)

This is a simple Express-based mock server that implements the API expected by src/YourApp.tsx.

Quick start:

1. Install dependencies:

   cd mock
   npm install

2. Start server:

   npm start

The server listens on port 4000 by default. You can change it by setting PORT environment variable.

Implemented endpoints:

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

Notes:
- Uploaded files are saved to mock/uploads and served at /uploads/<filename>
- Data is stored in-memory; restart server to reset.

How to use with YourApp front-end:
- Run this mock server locally (port 4000), then run your frontend. Pass apiConfig prop to YourApp to point to the mock server endpoints, e.g.:

  import YourApp from './src/YourApp';
  const apiConfig = {
    feed: 'http://localhost:4000/api/feed',
    search: 'http://localhost:4000/api/search',
    like: (id) => `http://localhost:4000/api/item/${id}/like`,
    comment: (id) => `http://localhost:4000/api/item/${id}/comment`,
    profile: 'http://localhost:4000/api/profile',
    upload: 'http://localhost:4000/api/upload',
    favorites: 'http://localhost:4000/api/profile/favorites',
    works: 'http://localhost:4000/api/profile/works',
    messages: 'http://localhost:4000/api/messages',
  };

  <YourApp apiConfig={apiConfig} />

