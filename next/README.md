# Play It Back

A full-screen Three.js artist constellation with one compact top bar. Search, genre/time filters, persistent light/dark themes, and orbit controls stay within reach. There is no sidebar, dashboard, album shelf, or permanent inspector.

## Run

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. Without a private snapshot the app shows a labeled sample collection.

## Personal Spotify snapshot

```sh
npm run spotify:snapshot -- /path/to/authorized/credentials-directory
npm run genres:enrich -- 450
```

The snapshot helper reads existing `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_REFRESH_TOKEN` entries from `.env` and `.env.local` in the directory supplied. It does not copy credentials or create environment files. This is a local development helper, not public OAuth. It pages through available top items and playlists, retains source metadata, and reports unavailable permissions. Optional genre enrichment reads public Last.fm artist-tag pages; it sends only public artist names.

`data/private-spotify.json` is ignored. Do not expose the local server publicly with the personal snapshot present. Tokens, raw exports, screenshots, browser test artifacts, and local memory notes are excluded from Git.

## Collection semantics

- Dots are artists, colored by a broad genre family. Dot size reflects the number of available songs, not listening minutes or play count. Lines connect artists sharing original provider genre tags; artists without recognized genre tags are omitted from the constellation. Genre colors overlap in a single cloud, and the default camera is angled. Artist names appear only on hover or touch. A sparse nearest-neighbor skeleton appears at rest; hover or select an artist to reveal its additional shared-tag connections. The compact color legend previews genres on hover/focus and filters them on click.
- **All available** combines retrieved top lists and playlist contents. **4 weeks** and **6 months** use Spotify's corresponding top-item periods. These are ranked affinity lists, not a complete account history.
- The top-bar menu contains a playlist filter, keyboard-friendly artist list, 2D view, and local history import. Albums and playlists remain in the data model, but no separate collection pages are shown.
- History import accepts Spotify ZIP/JSON files, processes them locally, and stores only music metadata and play dates in IndexedDB. Plays shorter than 30 seconds are excluded. Imported time filters use the most recent 28 or 183 days relative to today. Imports persist locally until removed.
- Genre tags come from Spotify or public Last.fm community tags, with provenance retained in the data. Grouping is approximate. Imports reuse known metadata; unknown imported artists receive no invented genres.
- Spotify links open the official app/site; Play It Back does not stream audio.

## Checks

```sh
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser suite covers the minimal layout, hover-only names, actual camera orbit movement, artist selection, search, filters, dialogs, theme persistence, mobile viewport fit, and local import privacy/persistence/removal. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use an existing Chromium installation.

## Design references

[Lyra](https://github.com/RutvikGupta/lyra) informed the genre graph and local-history approach. This project uses its own renderer, data model, and interface. The circular theme reveal is adapted from the owner's portfolio behavior.
