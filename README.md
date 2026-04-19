<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=200&section=header&text=AniCircle&fontSize=72&fontColor=fff&animation=twinkling&fontAlignY=38&desc=Track%20it.%20Rate%20it.%20Live%20it.&descAlignY=60&descSize=20" width="100%"/>

<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=22&duration=3500&pause=1000&color=A855F7&center=true&vCenter=true&multiline=true&width=700&height=80&lines=Your+personal+anime+universe+%F0%9F%8C%8C;120%2B+anime+tracked+%E2%80%94+and+counting+%E2%9C%A8;Built+by+an+otaku%2C+for+otakus+%F0%9F%8E%8C" alt="Typing SVG" /></a>

<br/><br/>

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![AniList](https://img.shields.io/badge/AniList-API-02A9FF?style=for-the-badge&logo=anilist&logoColor=white)

![Status](https://img.shields.io/badge/Status-Live%20%F0%9F%9F%A2-brightgreen?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)

<br/>

**[ [🌐 Live Demo](https://www.anicircle.xyz) ]**

</div>

---

<img align="right" src="https://media.giphy.com/media/SWoSkN6DxTszqIKEqv/giphy.gif" width="320" alt="Anime Developer"/>

## What's AniCircle?

Started as a simple side project, AniCircle turned into something I actually use every day.

It's a full-stack anime tracking app — you log what you've watched, rate it, track episodes, follow friends, get notified when new seasons drop, and see a deep-dive breakdown of your entire watch history in the **Otaku Analytics** dashboard.

No clutter. No ads. No "upgrade to premium". Just your anime, organized the way you actually want.

**Built with:**
- AniList GraphQL API for rich anime metadata
- Supabase for real-time data + auth
- React + TypeScript for a snappy, type-safe frontend
- Recharts for the analytics visualizations

<br clear="both"/>

---

## Features

<table>
<tr>
<td width="50%" valign="top">

### 📋 Anime List
Track every show across five categories — **Watching**, **Completed**, **Plan to Watch**, **On Hold**, and **Dropped**. Add notes, ratings, and episode progress. Search directly from the AniList database and bulk-add entire multi-season franchises in one click.

</td>
<td width="50%" valign="top">

### 🔥 Otaku Analytics
Your personal "Spotify Wrapped" for anime. See how many days of your life you've spent watching, your genre DNA as a neon pie chart, which studios dominate your list, your top-rated shows, and rating distributions — all in one stunning dashboard.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📡 Sequel Radar
Never get blindsided by a new season again. The Sequel Radar scans your completed list and shows which anime have confirmed upcoming sequels — with airing dates and episode counts pulled live from AniList.

</td>
<td width="50%" valign="top">

### 🔔 Notification Center
Get notified when new episodes drop for shows you're currently watching. Supports native **Web Push Notifications** (works even when your browser tab is closed, via a background Service Worker).

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 👥 Friends & Social
Send friend requests, view what your friends are watching, and compare lists. You can see their full anime library and check if you share any titles in common.

</td>
<td width="50%" valign="top">

### ⚙️ Preferences & Filters
Filter by status, ranking, or search by title. Adult content is hidden by default and tucked away in a discreet settings menu — safe to use in public.

</td>
</tr>
</table>

---

## Tech Stack

<div align="center">

| Layer | What's used |
|-------|-------------|
| **Frontend** | React 18 · TypeScript · Vite · Wouter (routing) |
| **UI** | shadcn/ui · Tailwind CSS · Recharts · Lucide Icons |
| **Backend** | Express.js · Node.js |
| **Database** | Supabase (PostgreSQL) · Drizzle ORM |
| **Auth** | Supabase Auth · Google OAuth |
| **Data API** | AniList GraphQL API |
| **Notifications** | Web Push API · Service Workers |

</div>

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- (Optional) Google OAuth credentials for social login

### Setup

```bash
# Clone
git clone https://github.com/Pranav7758/AniCircle.git
cd AniCircle

# Install dependencies
npm install

# Copy and fill in your environment variables
cp .env.example .env
```

### Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_DATABASE_URL=your_postgres_connection_string
```

### Database

1. Create a project at [supabase.com](https://supabase.com)
2. Open the **SQL Editor**
3. Run the schema from `SUPABASE_SETUP.sql`
4. Enable Row Level Security on your tables

### Run it

```bash
npm run dev
# → http://localhost:5000
```

---

## Project Structure

```
AniCircle/
│
├── client/                    # React frontend
│   ├── public/
│   │   └── sw.js              # Service Worker (push notifications)
│   └── src/
│       ├── components/        # UI components (cards, radar, analytics, etc.)
│       ├── hooks/             # Custom hooks (auth, push notifications)
│       ├── lib/               # Supabase client setup
│       ├── pages/             # Route pages (Index, Auth)
│       └── services/          # AniList API + Supabase data layer
│
├── server/                    # Express backend
│   ├── index.ts               # Entry point
│   ├── routes.ts              # REST API routes
│   └── vite.ts                # Vite dev server integration
│
├── shared/
│   └── schema.ts              # Drizzle schema (source of truth)
│
├── scripts/
│   └── importCsv.ts           # Bulk import from MAL CSV export
│
└── package.json
```

---

## Roadmap

- [x] Anime tracking with 5 status categories
- [x] AniList GraphQL integration
- [x] MAL CSV import support
- [x] Otaku Analytics dashboard
- [x] Sequel Radar
- [x] Friend system
- [x] In-app notification center
- [x] Web Push Notifications (background alerts)
- [x] 3D glassmorphism UI
- [x] Hentai content filter (discreet settings menu)
- [ ] Manga tracking
- [ ] Recommendation engine (based on genre DNA)
- [ ] Watch party / sync feature
- [ ] Mobile app (React Native)
- [ ] Discord Rich Presence integration

---

## Contributing

PRs are welcome. If you're adding a big feature, open an issue first so we can discuss it.

```bash
git checkout -b feature/your-feature-name
git commit -m 'feat: add your feature'
git push origin feature/your-feature-name
# → open a Pull Request
```

---

## Credits

- [AniList API](https://anilist.co) — the backbone of all anime data
- [shadcn/ui](https://ui.shadcn.com/) — for the clean component system
- [Recharts](https://recharts.org/) — powers the analytics charts
- [Supabase](https://supabase.com) — auth + real-time backend

---

<div align="center">

**Developer:** Pranav Borse  
**Email:** borsepranav700@gmail.com  
**Live:** [anicircle.xyz](https://www.anicircle.xyz)

<br/>

<img src="https://media.giphy.com/media/LnQjpWaON8nhr21vNW/giphy.gif" width="48"/>

*made for the anime community, by someone who loses sleep over cliffhangers*

<br/>

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer" width="100%"/>

</div>
