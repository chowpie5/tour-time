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
