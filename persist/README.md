Persistent API for YourApp

This folder contains the persist service with authentication and a model registry.

Scripts:
- npm start          Start the server (default port 4001)
- npm run reset      Reset DB and uploads (delete files) - server will re-seed on next start

Docker:
- Persist image built via persist/Dockerfile
- docker-compose.yml provided to run persist + a static nginx frontend service (mount your built frontend into ./frontend_build)

Model fetching API:
- POST /api/models { name, url, api_key }  (auth required)
- GET /api/models  (auth required)
- POST /api/models/:id/fetch  (auth required) - server will fetch remote model URL using Authorization: Bearer <api_key> header and save to /uploads/models
- GET /api/models/:id  (auth required)

Authentication:
- POST /api/auth/register { username, password, display_name }
- POST /api/auth/login { username, password }
- Use Authorization: Bearer <token> for protected endpoints

Security notes:
- api_key is stored in the DB in plaintext in this demo. For production, encrypt and restrict access.
- JWT_SECRET default is 'change-this-secret' - set an environment variable in production.
