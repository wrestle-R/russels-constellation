# Play It Back

A Next.js music collection explorer with a Three.js artist constellation, genre navigation, album and playlist browsing, song search, and persistent light/dark themes.

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

- Dots are artists, colored by a broad genre family. Dot size reflects the number of available songs, not listening minutes or play count. Lines connect artists sharing original provider genre tags; artists without tags remain unclassified.
- **All available** combines retrieved top lists and playlist contents. **4 weeks** and **6 months** use Spotify's corresponding top-item periods. These are ranked affinity lists, not a complete account history.
- Albums are the albums represented in available songs. They are not claimed to be the saved-album library. Playlists are current collections and do not change with the time filter.
- History import accepts Spotify ZIP/JSON files, processes them locally, and stores only music metadata and play dates in IndexedDB. Plays shorter than 30 seconds are excluded. Imported time filters use the most recent 28 or 183 days relative to today. Imports persist locally until removed.
- Genre tags come from Spotify or public Last.fm community tags, with source links in the inspector. Grouping is approximate; original tags remain visible. Imports reuse known metadata; unknown imported artists receive no invented genres.
- Spotify links open the official app/site; Play It Back does not stream audio.

## Checks

```sh
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser suite covers artist selection, search, filters, navigation, dialogs, theme persistence, mobile overflow, and local import privacy/persistence/removal. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use an existing Chromium installation.

## Design references

[Lyra](https://github.com/RutvikGupta/lyra) informed the genre graph and local-history approach. This project uses its own renderer, data model, and interface. The circular theme reveal is adapted from the owner's portfolio behavior.
