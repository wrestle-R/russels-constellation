# Russell’s constellation

A personal, local-only song constellation. One compact top bar provides search, genre/time previews, camera controls, and light/dark themes. The layered record mark keeps the glass-like double-panel treatment.

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

- Every dot represents a song. Songs are grouped by their primary artist; edges connect only songs sharing that primary artist. Each artist's songs form one connected tree, without links to unrelated artists or an all-to-all hairball.
- Genres occupy fixed neighboring homes. Artist centers use their primary genre plus a weighted contribution from secondary genres. Song dots sit close to their artist. Regions overlap at boundaries; they are not isolated boxes or random positions across the entire canvas.
- More **recorded plays** means a darker color in both themes, using a logarithmic scale. Counts come only from timestamped listening events. Spotify ranking, playlist membership, and catalog size are never treated as play counts. Missing counts are unknown, not zero; hover tooltips show the source and limitation.
- The current Spotify snapshot's recent events are only a partial observation window, not lifetime totals. Import extended streaming history for counts across that history. Period-specific counts use the selected date window.
- All available combines saved top lists and playlist contents. Four weeks and six months use saved Spotify top-track lists, or actual play dates for imported history.
- Hovering a genre or period temporarily previews that tab, even if a different tab is selected. Click persists the choice. Leaving the tab returns to the selected view. Filtering preserves song coordinates and the camera.
- The menu contains a playlist filter, keyboard-friendly song list, 2D view, and local history import/removal. Song names remain hover/tap-only in the scene.
- Import accepts Spotify ZIP/JSON files, processes them locally, and stores music metadata and play dates in IndexedDB. Plays shorter than 30 seconds are excluded. Duplicate events are counted once. Imports persist locally until removed.
- Provider genre tags are retained as metadata. Songs without recognized genre metadata are omitted rather than receiving an invented category.
- App startup, reload, search, filtering, and imports make no off-device requests. Fonts are bundled locally. Spotify links are explicit navigation only; this app does not stream audio.

## Checks

```sh
npm run build
npx playwright install chromium
npm run test:e2e
```

Tests cover artist-only song connectivity, deterministic layout, play-event counting and monotonic color depth, genre/time hover overrides, the minimal layout, orbit controls, search, dialogs, theme persistence, mobile fit, local import privacy, and absence of off-device requests. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use an existing Chromium installation.

## Design references

[Lyra](https://github.com/RutvikGupta/lyra) informed the genre graph and local-history approach. This project uses its own renderer, data model, and interface. The circular theme reveal is adapted from the owner's portfolio behavior.
