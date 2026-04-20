# Learn With Me

AI-powered IGCSE Mathematics practice platform with two real workspaces:

- Teachers create classrooms, publish structured exercises, generate drafts with Gemini, and review analytics.
- Students join classes, solve with text or image uploads, receive Socratic feedback in English, unlock notebook entries, and earn XP/streak rewards.

## Stack

- `apps/api`: Express + TypeScript + MongoDB + JWT + Gemini REST API
- `apps/web`: Next.js 16 + React 19 + Tailwind CSS 4 + React Query

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Local env files are already prepared in ignored files:

- `apps/api/.env.local`
- `apps/web/.env.local`

If you need to recreate them manually, use the variable names from `.env.example`.

3. Start both apps:

```bash
npm run dev
```

4. Open the app at `http://localhost:3000`.

## Workspace Flows

### Teacher

1. Register a teacher account.
2. Create a classroom from `/app/teacher`.
3. Open the class and author an exercise with the built-in editor.
4. Optionally use AI Co-pilot to draft structured steps and hint questions.
5. Publish the exercise and monitor blind spots, roster progress, flagged learners, and mastery signals.

### Student

1. Register a student account.
2. Join a class from `/app/student` using the classroom code.
3. Open an exercise from the classroom or dashboard.
4. Submit text reasoning and/or an image of handwritten working.
5. Review feedback, hotspot guidance, notebook capture, XP, streak, and attempt history.

## Checks

Frontend:

```bash
npm run lint -w apps/web
npm run build -w apps/web
```

Backend:

```bash
npm run lint -w apps/api
npm test -w apps/api
npm run build -w apps/api
```

Whole workspace:

```bash
npm run lint
npm run build
npm test
```

## Deployment

### Frontend on Vercel

- Root directory: `apps/web`
- Install command: `npm install`
- Build command: `npm run build -w apps/web`
- Output: default Next.js output
- Required env:
  - `NEXT_PUBLIC_API_URL=https://<your-render-service>/api`

### Backend on Render

- `render.yaml` is included at the repo root.
- The API now respects `PORT` automatically through the config loader.
- Required env:
  - `MONGODB_URI`
  - `JWT_SECRET`
  - `GEMINI_API_KEY`
  - `WEB_URL=https://<your-vercel-domain>`
  - Optional: `GEMINI_MODEL`, `UPLOAD_MAX_MB`

## API Summary

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard`
- `GET /api/classes`
- `POST /api/classes`
- `POST /api/classes/join`
- `GET /api/classes/:classroomId`
- `GET /api/classes/:classroomId/analytics`
- `POST /api/exercises/ai-draft`
- `POST /api/exercises`
- `PUT /api/exercises/:exerciseId`
- `GET /api/exercises/:exerciseId`
- `GET /api/exercises/:exerciseId/submission`
- `POST /api/exercises/:exerciseId/submit`
- `GET /api/notebook`
- `GET /api/notebook/:entryId`
