# App Store Review Scraper — Next.js Dashboard

## Context
The current project is a Python CLI tool that scrapes App Store reviews using Apple's RSS feed API. The goal is to replace it with a Next.js web application hosted on a VPS, providing a browser-based UI for inputting app IDs, filtering by rating, and viewing results in real-time.

## Architecture

**Single Next.js app** (App Router, TypeScript, Tailwind CSS, shadcn/ui). No external database or Python dependency — all scraping happens via Next.js API routes calling Apple's iTunes RSS feed API directly.

### API Endpoints
- `POST /api/scrape` — Accepts `{ appIds: string[], ratings: number[], maxReviews: number }`. `ratings` is an array of allowed ratings (e.g., `[1,2]` or `[4]`). Streams results as server-sent events (SSE): one event per app with its reviews, a final "done" event.

### Data Flow
1. User enters/pastes app IDs or uploads a `.txt` file, selects rating filter
2. Frontend sends POST to `/api/scrape`
3. API route iterates app IDs, fetches from `https://itunes.apple.com/rss/customerreviews/id={id}/sortBy=mostRecent/json` and `https://itunes.apple.com/lookup?id={id}` for app info
4. Each app's results are streamed back as an SSE event
5. Frontend renders results as they arrive

### External APIs Used
- **iTunes Lookup API**: `https://itunes.apple.com/lookup?id={app_id}` — app name, icon, metadata
- **iTunes RSS Reviews Feed**: `https://itunes.apple.com/rss/customerreviews/id={app_id}/sortBy=mostRecent/json` — review entries with rating, title, text, author, date, version

## UI Layout

### Split View (Dashboard)
- **Left sidebar** (~250px): Per-app summary cards showing app name, icon, review count matching filter, rating distribution bar
- **Right main area**: Scrollable review feed — each review rendered as a card with star rating (color-coded), title, review text, author, date, app version, and app name tag
- **Top bar**: Input area (textarea + file upload), rating filter dropdown, "Scrape" button

### Rating Filter Options
- "1 or 2 stars" → ratings [1, 2]
- "3 stars" → ratings [3]
- "4 stars" → ratings [4]
- "5 stars" → ratings [5]

The filter is an inclusive list of ratings to include (not a max threshold).

### Input Parsing
The app accepts mixed input — raw IDs, full App Store URLs, or any combination. A single parser handles all formats:

**URL format**: `https://apps.apple.com/us/app/peptide-ai-stack-intelligence/id6760374374` → extracts `6760374374`
**Raw ID format**: `6760374374` or `id6760374374` → extracts `6760374374`
**Mixed**: A paste or file can contain both URLs and IDs intermixed — parser extracts all IDs and deduplicates.

**Input methods:**
- Textarea for pasting (IDs, URLs, or mixed)
- File upload accepting any text-based format (`.txt`, `.json`, `.csv`, etc.) — the parser reads the raw text and extracts IDs/URLs from it

### Streaming UX
- Scrape button shows spinner while active
- Sidebar cards appear one by one as each app completes
- Review feed updates in real-time
- Progress indicator showing "X of Y apps scraped"

## Project Structure

```
appstore_app_review_scraping/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout with fonts, metadata
│   │   ├── page.tsx            # Main dashboard page
│   │   ├── globals.css         # Tailwind + custom styles
│   │   └── api/
│   │       └── scrape/
│   │           └── route.ts    # SSE scraping endpoint
│   ├── lib/
│   │   ├── scraper.ts          # Fetch + parse iTunes RSS feed
│   │   ├── parse-app-ids.ts    # Extract IDs from mixed text (URLs, raw IDs, id-prefixed)
│   │   └── types.ts            # Review, AppInfo, ScrapeEvent types
│   └── components/
│       ├── app-input.tsx       # Textarea + file upload
│       ├── rating-filter.tsx   # Rating filter dropdown
│       ├── sidebar.tsx         # App summary cards
│       ├── app-summary-card.tsx
│       ├── review-feed.tsx     # Scrollable review list
│       └── review-card.tsx     # Single review display
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── postcss.config.mjs
```

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui (Button, Select, Textarea, Card, Badge components)
- No database — stateless scraping

## Verification
1. Run `npm run dev` and open browser
2. Paste mixed input (e.g., `6760374374, https://apps.apple.com/us/app/oasis-whats-healthy/id6499478532`)
3. Select "1 or 2 stars" filter, click Scrape
4. Verify: sidebar populates per-app stats, reviews stream into feed
5. Upload a `.txt` or `.json` file with mixed IDs/URLs, verify parsing works
6. Build for production: `npm run build && npm start`
