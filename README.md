# Russell’s constellation

A private, local-first song constellation built with Next.js and Three.js. Each dot is a song; songs by the same primary artist form connected groups within overlapping genre regions. Recorded listening events determine color depth.

## Development

```sh
cd next
npm install
npm run dev
```

Open http://127.0.0.1:3000. The app reads a local snapshot and optional browser-stored history. It does not contact Spotify or external font services when opened, refreshed, or filtered. Snapshot/metadata refresh commands are manual-only tools.

Personal snapshots, credentials, screenshots, and local notes are excluded from Git. Without a snapshot, a sample collection is available.

[Lyra](https://github.com/RutvikGupta/lyra) informed the initial constellation and local-history concept; this project has its own renderer and data model.
