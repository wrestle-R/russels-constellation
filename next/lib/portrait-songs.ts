import type { MapNode } from "./constellation";

const normalize = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’‘]/g, "'");

// Editorial love/heartbreak selections supplement title cues; genre alone isn't a love-song tag.
const loveSongs = new Set([
  "bam bam",
  "my mistake",
  "runnin' home to you",
  "bulleya",
  "calm down",
  "interlude: i'm not angry anymore",
  "the shade",
  "double take",
  "teenage dream",
  "line without a hook",
  "we fell in love in october",
  "wildflower",
  "mr. loverman",
  "dandelions",
  "cold/mess",
  "water fountain",
  "the way you felt",
  "iris",
  "back to friends",
  "sailor song",
  "little bit better",
  "imagination",
  "white ferrari",
  "glimpse of us",
  "arcade",
  "you broke me first",
  "golden hour",
  "co2",
  "undressed",
  "wonderwall",
  "exile",
  "lucid dreams",
  "idfc",
  "let her go",
  "die for you",
  "sanctuary",
  "slow dancing in the dark",
  "like you do",
  "yeah right",
  "wanted u",
  "test drive",
  "gimme love",
  "attention",
  "will he",
  "afterthought",
  "your man",
  "ew",
  "feeling like the end",
  "before the day is over",
  "dissolve",
  "night rider",
  "1am freestyle",
  "worldstar money",
  "make you mine",
  "i miss you, i'm sorry",
  "die trying",
  "i just wanna know",
  "if you want love",
  "from the start",
  "me and my broken heart",
  "dynasty",
  "treat you better",
  "good 4 u",
  "rude",
  "deja vu",
  "till forever falls apart",
  "brown eyes, brown hair",
  "i found",
  "i don't want to watch the world end with someone else",
  "lie",
  "die first",
  "more than you know",
  "dark paradise",
  "cloud 9",
  "reflections",
  "let go",
  "u & me",
  "half of forever",
  "when i lose you",
  "this side of paradise",
  "ocean eyes",
  "stitches",
  "those eyes",
  "heartless",
  "summertime sadness",
  "505",
  "before you leave me",
  "fall into me",
  "carry you home",
  "r u mine?",
  "out of my league",
  "i think i'm in love",
  "got you on my mind",
  "eastside",
  "space song",
  "snowman",
  "die with a smile",
  "someone you loved",
  "honey, i'm good",
  "can you hold me",
  "you belong with me",
  "everywhere",
  "you're special",
  "nights like this",
  "traitor",
  "drivers license",
  "glad you came",
  "almost lover",
  "potential",
  "that should be me",
  "more than words",
  "i wanna be yours",
  "sweater weather",
  "space bound",
  "favorite crime",
  "lacy",
  "if by chance",
  "please don't say you love me",
  "enough for you",
  "all of the stars",
  "never be alone",
  "all i want",
  "yours",
  "1 step forward, 3 steps back",
  "logical",
  "so american",
  "when i look at you",
  "car's outside",
  "dancing with your ghost",
  "romantic homicide",
  "young and beautiful",
  "heather",
  "sparks",
  "atlantis",
  "somebody that i used to know",
  "losing interest",
  "cry",
  "do i wanna know?",
  "beanie",
  "idk you yet",
  "apologize",
  "apocalypse",
  "like real people do",
  "the most beautiful thing",
  "september song",
  "angels like you",
  "stuck with u",
  "mulaqat",
  "tumblr girls",
  "one more dance",
  "she will be loved",
  "enchanted",
  "sweet creature",
  "stubborn love",
  "the night we met",
  "photograph",
  "perfect",
  "thinking out loud",
  "a thousand years",
  "all of me",
  "say you won't let go",
  "until i found you",
  "can't help falling in love",
  "just the way you are",
  "say you won't let go",
  "someone like you",
  "when i was your man",
  "remember that night?",
  "agar tum saath ho",
  "tum hi ho",
  "apna bana le",
  "aashiq tera",
  "kesariya",
  "raabta",
  "hawayein",
  "shayad",
  "kabira",
  "ranjha",
  "pee loon",
  "tu jaane na",
]);
const notRomance = new Set([
  "self love",
  "no love",
  "can you feel my heart",
  "heart of a champion",
  "how do i say goodbye",
  "family line",
  "letter to my 13 year old self",
]);

export function isGlimpseOfUs(song: MapNode) {
  return (
    normalize(song.track.name) === "glimpse of us" &&
    normalize(song.artist.name) === "joji"
  );
}

export function isRomanticPortraitSong(song: MapNode) {
  if (isGlimpseOfUs(song)) return true;
  const name = normalize(song.track.name)
    .replace(/\s*\(.*$/, "")
    .replace(/\s+-\s+.*$/, "")
    .trim();
  const artist = normalize(song.artist.name);
  if (
    song.artist.genres.some((g) =>
      /gospel|worship|christian|devotional|bhajan|kirtan|hymn/i.test(g),
    )
  )
    return false;
  if (notRomance.has(name)) return false;
  if (name === "hold on" && artist === "chord overstreet") return true;
  if (name === "home") return /edith whiskers|edward sharpe/.test(artist);
  if (artist === "cigarettes after sex") return true;
  return (
    loveSongs.has(name) ||
    /\b(love|lover|loving|romantic|romance|kiss|kisses|heartbreak|broken heart|valentine|soulmate|darling|marry|wedding|pyaar|pyar|ishq|mohabbat|aashiq|sanam|kaadhal|kadhal)\b/.test(
      name,
    )
  );
}

// Coordinates match the actual two lenses in the fixed master portrait (1230 × 1278).
export function portraitLens(x: number, y: number): 0 | 1 | 2 {
  const px = x * 1278 + 615;
  const py = (0.5 - y) * 1278;
  if (((px - 445) / 122) ** 2 + ((py - 650) / 70) ** 2 < 1) return 1;
  if (((px - 785) / 118) ** 2 + ((py - 650) / 70) ** 2 < 1) return 2;
  return 0;
}
