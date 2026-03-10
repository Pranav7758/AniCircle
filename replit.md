# AniCircle - Anime Tracker

## Overview
AniCircle is a full-stack anime tracking application that allows users to:
- Track their anime watchlist with episodes watched, ratings, and notes
- Search and add anime from MyAnimeList via Jikan API
- Rank their favorite anime
- Connect with friends and view their anime lists
- Receive notifications about anime updates

## Tech Stack
- **Frontend**: React + Vite + TypeScript
- **Backend**: Express.js + TypeScript
- **Database**: Supabase PostgreSQL with Drizzle ORM
- **Authentication**: Supabase Auth (email/password)
- **Styling**: Tailwind CSS + shadcn/ui components

## Project Structure
```
client/                 # Frontend React application
  src/
    components/         # Reusable UI components
    hooks/              # Custom React hooks (use-auth.tsx)
    lib/                # Utility functions, supabase client
    pages/              # Page components (Auth.tsx, Index.tsx)
    services/           # API services (animeUpdates.ts)
server/                 # Backend Express application
  db.ts                 # Database connection (Supabase PostgreSQL)
  index.ts              # Server entry point
  routes.ts             # API routes (uses Supabase JWT auth)
  storage.ts            # Data access layer
  vite.ts               # Vite dev server integration
shared/
  schema.ts             # Drizzle database schema (profiles, anime, friends, notifications)
```

## Database Schema
- **profiles**: User profiles linked to Supabase Auth (id, email, username, avatar_url)
- **anime**: User's anime entries with title, episodes, rating, mal_id, etc.
- **friends**: Friend relationships between users
- **notifications**: Anime update notifications

## Environment Variables
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (for server)
- `SUPABASE_DATABASE_URL`: PostgreSQL connection string

## API Routes
- `GET /api/profile` - Get current user profile
- `GET /api/anime` - Get user's anime list
- `POST /api/anime` - Add anime entries
- `PATCH /api/anime/:id` - Update anime entry
- `DELETE /api/anime/:id` - Delete anime entry
- `GET /api/friends` - Get user's friends
- `GET /api/friends/requests` - Get friend requests
- `POST /api/friends` - Send friend request
- `PATCH /api/friends/:id` - Update friend status
- `GET /api/friends/:friendId/anime` - Get friend's anime list
- `GET /api/notifications` - Get notifications
- `PATCH /api/notifications/:id/read` - Mark notification as read
- `POST /api/notifications/read-all` - Mark all notifications as read
- `GET /api/profiles/:id` - Get public profile info

## Authentication
Authentication is handled by Supabase Auth on the client side. The server validates JWT tokens from Supabase for protected routes.

## Running the Application
The application runs via the "Start application" workflow which executes `npm run dev`.
This starts the Express server on port 5000 with Vite middleware for the frontend.

## Recent Changes (December 2025)
- Connected to Supabase database at qakolgnkvrtbbmjfalzv.supabase.co
- Fixed folder structure (moved files from anime-watchlist-logbook to root)
- Updated server routes to use Supabase JWT authentication
- Client uses Supabase Auth for login/register
- Schema uses profiles table (linked to Supabase Auth users)
