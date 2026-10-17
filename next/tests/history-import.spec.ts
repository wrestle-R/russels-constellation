import { test, expect } from "@playwright/test";
import { zipSync, strToU8 } from "fflate";
import { importHistory } from "../lib/history-import";
import { recordedPlayCounts, type Collection } from "../lib/music";

const base: Collection = {
  version: 2,
  source: "spotify",
  fetchedAt: "",
  albums: [],
  playlists: [],
  top: {},
  status: {},
  artists: [
    { id: "owner", name: "Artist", genres: ["indie pop"], url: "" },
    { id: "guest", name: "Guest", genres: ["soul"], url: "" },
  ],
  tracks: [
    {
      id: "abc123",
      name: "Song",
      artist: "Artist",
      artistId: "owner",
      artistIds: ["owner", "guest"],
      album: "Album",
      url: "",
    },
  ],
};
const row = {
  ts: "2021-02-03T12:00:00Z",
  ms_played: 90000,
  master_metadata_track_name: "Song",
  master_metadata_album_artist_name: "ARTIST",
  master_metadata_album_album_name: "Album",
  spotify_track_uri: "spotify:track:abc123",
  ip_addr: "private-fixture",
  platform: "private-device",
  conn_country: "private-country",
};

test("extended archives merge years, deduplicate plays and preserve artist metadata", async () => {
  const archive = zipSync({
    "Spotify Extended Streaming History/Streaming_History_Audio_2021.json":
      strToU8(
        JSON.stringify([
          row,
          { ...row, ts: "2021-02-03T12:00:00.000Z" },
          row,
          { ...row, ts: "2021-02-04T12:00:00Z", ms_played: 29999 },
          { ...row, master_metadata_track_name: null, episode_name: "Podcast" },
        ]),
      ),
    "Spotify Extended Streaming History/Streaming_History_Audio_2026.json":
      strToU8(
        JSON.stringify([
          { ...row, ts: "2026-01-01T12:00:00Z" },
          {
            ...row,
            ts: "2026-01-02T12:00:00Z",
            spotify_track_uri: "spotify:track:new123",
            master_metadata_track_name: "New song",
          },
        ]),
      ),
    "account.json": strToU8('{"secret":"ignore"}'),
  });
  const result = await importHistory(
    [new File([archive], "history.zip")],
    base,
    () => {},
  );
  expect(result.plays).toHaveLength(3);
  expect(result.tracks).toHaveLength(2);
  expect(result.artists.find((a) => a.id === "owner")?.genres).toEqual([
    "indie pop",
  ]);
  expect(result.tracks.find((t) => t.id === "abc123")?.artistIds).toEqual([
    "owner",
    "guest",
  ]);
  expect(result.artists.some((a) => a.id === "guest")).toBe(true);
  expect(
    recordedPlayCounts(result, "all", Date.parse("2026-10-17")),
  ).toMatchObject({ abc123: 2, new123: 1 });
  expect(JSON.stringify(result)).not.toMatch(
    /private-fixture|private-device|private-country|secret/,
  );
  expect(base.tracks[0].artistIds).toEqual(["owner", "guest"]);
});

test("basic history handles dates and malformed or empty files clearly", async () => {
  const result = await importHistory(
    [
      new File(
        [
          JSON.stringify([
            {
              endTime: "2022-04-05 12:30",
              msPlayed: 30000,
              trackName: "Basic song",
              artistName: "Artist",
            },
            {
              endTime: "bad date",
              msPlayed: 90000,
              trackName: "Invalid",
              artistName: "Artist",
            },
          ]),
        ],
        "StreamingHistory.json",
      ),
    ],
    base,
    () => {},
  );
  expect(result.plays).toHaveLength(1);
  expect(result.plays?.[0].playedAt).toBe("2022-04-05T12:30:00.000Z");
  await expect(
    importHistory([new File(["not json"], "bad.json")], base, () => {}),
  ).rejects.toThrow("valid JSON");
  await expect(
    importHistory([new File(["[]"], "empty.json")], base, () => {}),
  ).rejects.toThrow("30 seconds");
});
