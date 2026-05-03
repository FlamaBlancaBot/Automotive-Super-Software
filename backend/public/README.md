# Backend public folder

In production (single-domain deployment), the Node.js backend serves the built React frontend from this folder.

How it gets populated:

- Run the build script: `./scripts/prepare-backend-public.sh`
- This copies `frontend/dist/` into `backend/public/`

Do not commit sensitive files here. This folder should only contain static frontend build output.

