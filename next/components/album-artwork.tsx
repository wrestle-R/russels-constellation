"use client";
import { useState } from "react";
import Image from "next/image";
import { Disc3 } from "lucide-react";
import type { Track } from "../lib/music";

export default function AlbumArtwork({ track }: { track: Track }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="song-artwork">
      {failed ? (
        <div
          className="artwork-fallback"
          role="img"
          aria-label={`${track.album} artwork unavailable`}
        >
          <Disc3 size={32} strokeWidth={1} />
          <span>Artwork unavailable</span>
        </div>
      ) : (
        <Image
          src={`/api/artwork/${encodeURIComponent(track.id)}`}
          alt={`${track.album} album cover`}
          width={500}
          height={500}
          unoptimized
          loading="eager"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
