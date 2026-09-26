# Tour Time

A desktop app (Electron + React + TypeScript) for music tour managers.

| Page | What it does |
| --- | --- |
| **Overview** | Tour at a glance: next day's run of show, upcoming dates, open advances, spend vs. budget. |
| **Schedule** | Day-by-day itinerary for show, travel and off days: run of show, travel legs (bus/flight/train…), hotels, venue and promoter. |
| **Advancing** | Build advance templates (sections + fields for times, venue specs, parking, dressing rooms, production, merch). Advance each show against a template and mark answers confirmed. Time fields can be bound to schedule slots (load-in, doors, curfew…) so they update the schedule and day sheets automatically — and editing the time on the Schedule page writes back to the advance. Template edits apply to every show using it. |
| **Directory** | People (venue, promoter, crew, production, band, vendor) and venues, with search, filters and CSV export. |
| **Budget** | Budget vs. actual by category, expense log, daily financial day sheets with running totals, and show settlements (flat, guarantee vs. %, door deals, merch splits). |
| **Docs & Reports** | Store contracts, riders, stage plots etc. (auto-categorised, linkable to a day). Generate printable day sheets or full itineraries with selectable sections; print or save as PDF. |
| **Chat** | Real-time chat per tour with channels, presence and typing indicators. |

## Running

```bash
npm install
npm run dev        # Vite + Electron with hot reload
npm start          # production build, then launch Electron
npm run dist       # package installers with electron-builder
npm run dev:web    # renderer only, in a browser (data in localStorage)
```

Data is saved as JSON in the OS user-data folder; uploaded documents are copied into `documents/` next to it. Settings → Data has backup export/import.

## Chat server

Chat uses a small WebSocket server (`server/chat-server.cjs`). Everyone on a tour connects to the same server URL and room code (Settings → Chat).

- **Host from the app**: tick "Host a chat server on this computer" (on by default); teammates on the same network use `ws://<your-ip>:4455`.
- **Host centrally**: run `npm run chat-server` (`PORT` env var, default 4455) on any reachable machine, ideally behind TLS (`wss://`).

Messages are kept (last 500 per room) in `chat-history.json`.

## MCP servers

`.mcp.json` configures project MCP servers that Claude Code loads when you open this repo (approve them when prompted):

| Server | Use |
| --- | --- |
| `playwright` | Lets Claude drive and test the UI (`npm run dev:web`, then point it at http://localhost:5173). |
| `context7` | Up-to-date docs for Electron, React, Vite, etc. |
| `google-maps` | Geocoding, drive times/distances between cities for routing. Needs `GOOGLE_MAPS_API_KEY` in your environment. |
| `weather` | Open-Meteo forecasts for show and drive days (no key needed). |

Account connectors (Google Calendar, Gmail, Google Drive, Dropbox, Slack, DocuSign, QuickBooks/Xero, Supabase) are connected per user at claude.ai → Settings → Connectors rather than in this repo.

## Supabase backend (in progress)

`supabase/migrations/` holds the schema for the multi-user version: profiles, tours, tour members with roles (owner / manager / crew / viewer), email invites, all tour data, chat messages, and a private `tour-documents` storage bucket. Row-level security means people only ever see tours they belong to, crew and viewers can't see money, and removing someone cuts off their access immediately. Create tours with the `create_tour()` function and join with `accept_tour_invite()`.
