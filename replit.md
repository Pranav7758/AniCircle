# AniCircle - Anime Tracker

## Overview
AniCircle is a full-stack anime tracking and social platform that allows users to:
- Track their anime watchlist with episodes watched, ratings, and notes
- Search and add anime using AniList GraphQL API
- Rank their favorite anime with drag-and-drop
- Connect with friends, view their lists, compare stats, and watch Activity Feed
- Receive notifications about anime updates
- **Discover Tab**: Smart Recommendations (AniList-powered), Mood Picker, Trending Spotlight
- **Public Profile**: Shareable `/u/:shortId` pages viewable without login
- **Activity Feed**: Friends' real-time activity (adds, completions, ratings)
- **Radar**: Sequel/prequel chain tracking with airing dates
- **Analytics**: Genre/tag breakdown of watch history
- **Genre Filter**: Filter My List by genre

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

## Key Features
- **AniList Integration**: Fetches anime metadata (cover, episodes, airing info) via AniList GraphQL API with exponential backoff retry (3 attempts) for 429 rate limiting
- **Radar**: Airing schedule for "Watching" anime + sequel scanner for "Completed/Watching" list — only SEQUEL relations, with error states and retry buttons
- **Analytics Dashboard**: Rich stats including Format Breakdown donut, Genre DNA radar, Seasonal Preferences bars, Otaku Persona, Studio breakdown
- **AnimeGroupCard**: Poster-style cards grouped by title, with season collapsible, star ratings, neon status glow, and gradient progress bar

## Design System (Cinematic Anime OS Theme)
- **Font**: Outfit (headings) + Inter (body) via Google Fonts
- **Theme**: Deep dark (#0a0a0f) with neon purple (#8B5CF6) primary and blue (#3B82F6) secondary
- **Effects**: Aurora background, floating orbs, holo-glass glassmorphism, status-specific neon glows per status (watching/completed/plan/dropped/hold), animated 3D card hover
- **Auth page**: Split two-panel cinematic layout — left panel has decorative rings, orbiting dot, feature pills; right panel has the glass form card
- **Scrollbar**: Custom gradient purple-to-blue narrow scrollbar
- **CSS classes**: `.holo-glass`, `.card-3d-hover`, `.aurora-bg`, `.orb`, `.gradient-primary`, `.text-gradient`, `.neon-watching/completed/plan_to_watch/dropped/on_hold`, `.badge-*`, `.status-dot-*`, `.poster-overlay`, `.header-accent-strip`

## Recent Changes (March 2026)
- **Major UI overhaul**: Cinematic anime-inspired redesign across Auth, AnimeGroupCard, header, tabs, and index CSS
- **Auth page**: Two-panel layout with animated orbiting rings, floating orbs, aurora background, feature pills
- **AnimeGroupCard**: Poster-style with status-specific neon glow border, star ratings, gradient neon progress bar, cinematic cover overlay
- **Index header**: Gradient accent strip at top, pulsing logo glow, glass header with username display
- **Tabs**: Pill-style with gradient purple active state and neon shadow
- **Radar**: Fixed null `nextAiringEpisode` crash; error states with retry buttons for both airing and sequel sections
- **Airing schedule**: Filter null entries before sort (was crashing on `airingAt` access)
- Connected to Supabase database at qakolgnkvrtbbmjfalzv.supabase.co
- Fixed folder structure (moved files from anime-watchlist-logbook to root)
- Updated server routes to use Supabase JWT authentication
- Client uses Supabase Auth for login/register
- Schema uses profiles table (linked to Supabase Auth users)
