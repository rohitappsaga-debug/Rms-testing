# Manual Production Server Steps

Follow these steps to build and run the production server manually without using `bootstrap.bat`.

## Prerequisites
Ensure strict environment variables are set up in `robs-backend/.env` and `robs-frontend/.env`.

## 1. Install Dependencies
Run this in the root directory:
```bash
npm install
```
*This installs dependencies for both frontend and backend and generates the Prisma client.*

## 2. Build Frontend
Navigate to the frontend directory and build:
```bash
cd robs-frontend
npm run build
cd ..
```
*This bundles the React application into static files.*

## 3. Build Backend
Navigate to the backend directory and compile TypeScript:
```bash
cd robs-backend
npm run build
```
*This compiles the TypeScript code into JavaScript in the `dist` folder.*

## 4. Run Database Migrations
Ensure your database is up to date:
```bash
npm run migrate:prod
```
*This applies any pending migrations to your production database.*

## 5. Start the Server
Start the compiled backend server:
```bash
npm start
```
*The server will start on the configured port (default 3002) and serve the frontend static files.*

---

### Shortcut
You can combine steps 3, 4, and 5 by running:
```bash
cd robs-backend
npm run start:prod
```
