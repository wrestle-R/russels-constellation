# Russel’s constellation

A personal song constellation. The compact top bar contains only the name, fullscreen control, and light/dark toggle. On-canvas zoom buttons work on desktop and mobile; touch supports orbiting, pinch zoom, and song details. The layered record mark keeps the glass-like double-panel treatment.

## Run

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. Without a private snapshot the app shows the explicitly approved hosted showcase.

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
- The current Spotify snapshot's recent events are only a partial observation window, not lifetime totals. Existing browser-stored history remains readable; counts use all available stored events.
- The scene always shows the all-time saved collection: all saved top lists and playlist contents, or existing browser-stored history. No time tabs or search field are shown.
- Hover a genre to preview; click or tap to persist the choice. On mobile, swipe the genre strip to reach every style. Filtering preserves song coordinates and the camera.
- There is no options menu, playlist selector, song list, import dialog, or 2D switch. Song names remain hover/tap-only in the scene. Zoom buttons stay visible; the opening camera is angled and closer, with adaptive portrait framing.
- The existing history-processing library remains available to local development tools. Previously saved IndexedDB history is still loaded; removing the import UI does not erase browser data.
- Provider genre tags are retained as metadata. Songs without recognized genre metadata are omitted rather than receiving an invented category.
- App startup, reload, and filtering make no off-device requests. Fonts are bundled locally. This app does not stream audio. The renderer redraws for interaction or data changes instead of continuously drawing an idle scene.

## Checks

```sh
npm run build
npx playwright install chromium
npm run test:e2e
```

Tests cover artist-only song connectivity, deterministic layout, play counts and color depth, genre previews/taps, minimal controls, fullscreen success/failure, persisted themes, 320/390/430/768px touch layouts, real touch swipes/orbit/pinch, song tooltips, landscape resizing, and absence of off-device requests. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use an existing Chromium installation.

## Design references

[Lyra](https://github.com/RutvikGupta/lyra) informed the genre graph and local-history approach. This project uses its own renderer, data model, and interface. The circular theme reveal is adapted from the owner's portfolio behavior.

## Hosting

The private GitHub repository and Vercel project are named `russels-constellation`. Vercel builds the `next/` root directory. `lib/showcase-data.json` contains the owner-approved public song metadata, personal collection preferences, and aggregated recorded-play counts. It omits exact listening timestamps, image URLs, credentials, and raw history exports.

`npm run showcase:capture` explicitly refreshes that file from the current local snapshot. It does not fetch Spotify and is never run automatically during deployment. Commit the resulting showcase only when intentionally publishing an updated collection. Browser-imported history stays in that browser and is not published.
