import showcase from "../../../../lib/showcase-data.json";

const tracks = new Map(showcase.tracks.map((track) => [track.id, track]));
const artworkHosts = new Set([
  "i.scdn.co",
  "image-cdn-ak.spotifycdn.com",
  "image-cdn-fa.spotifycdn.com",
]);
const cache = { revalidate: 60 * 60 * 24 * 30 };

// Fetch artwork only when a song's details open. Cache public cover images;
// listening records and account credentials are never requested here.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const track = tracks.get(id);
  if (!track || !/^[a-zA-Z0-9]{22}$/.test(id))
    return new Response(null, { status: 404 });
  try {
    let image = (track as { image?: string }).image;
    if (!image) {
      const response = await fetch(
        "https://open.spotify.com/oembed?url=" +
          encodeURIComponent("https://open.spotify.com/track/" + id),
        {
          next: cache,
          signal: AbortSignal.timeout(6000),
        },
      );
      if (!response.ok) return new Response(null, { status: 404 });
      image = (await response.json()).thumbnail_url;
    }
    const url = new URL(image);
    if (url.protocol !== "https:" || !artworkHosts.has(url.hostname))
      return new Response(null, { status: 404 });
    const cover = await fetch(url, {
      next: cache,
      redirect: "error",
      signal: AbortSignal.timeout(6000),
    });
    const type = cover.headers.get("content-type") || "";
    if (!cover.ok || !/^image\/(jpeg|png|webp|avif)/.test(type))
      return new Response(null, { status: 404 });
    const bytes = await cover.arrayBuffer();
    if (bytes.byteLength > 4 * 1024 * 1024)
      return new Response(null, { status: 404 });
    return new Response(bytes, {
      headers: {
        "Content-Type": type,
        "Cache-Control":
          "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }
}
