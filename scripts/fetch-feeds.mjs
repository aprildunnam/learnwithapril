#!/usr/bin/env node
/**
 * Learn with April - feed sync.
 *
 * Pulls April's real, public blog RSS feed and YouTube channel feed and
 * writes them out as static JSON that the site reads at runtime (see
 * ai-with-april/assets/js/feeds.js). No API keys, no backend: both feeds are public,
 * keyless endpoints, so this can run on a schedule from GitHub Actions
 * (see .github/workflows/fetch-feeds.yml) or by hand with
 * `node scripts/fetch-feeds.mjs`.
 *
 * The channel fallback filters Shorts and obvious event promos so the site
 * favors durable walkthroughs. To feature a specific curated playlist instead,
 * upload history, change YOUTUBE_FEED_URL below to:
 *   https://www.youtube.com/feeds/videos.xml?playlist_id=PLxxxxxxxx
 * (Grab the playlist ID from the `list=` query param on the playlist's
 * YouTube URL.) No other code changes are required.
 */

const BLOG_FEED_URL = "https://aprildunnam.com/feed/";
const YOUTUBE_FEED_URL =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCz_x76EBX5UXsV27drGNh6w";
const YOUTUBE_VIDEOS_URL = "https://www.youtube.com/@AprilDunnam/videos";

// April's "speaking engagements" playlist, shown on /speaking/.
const SPEAKING_PLAYLIST_ID = "PLINAH02_IDH-knetYe3AuT3dNO2sXDooa";
const SPEAKING_FEED_URL =
  "https://www.youtube.com/feeds/videos.xml?playlist_id=" + SPEAKING_PLAYLIST_ID;

const MAX_ITEMS = 6;
const MAX_SPEAKING_ITEMS = 12;
const OUT_DIR = new URL("../data/", import.meta.url);

/** Decode the handful of HTML/XML entities these feeds actually use. */
function decodeEntities(str) {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8216;/g, "\u2018")
    .replace(/&#8220;/g, "\u201c")
    .replace(/&#8221;/g, "\u201d")
    .replace(/&#8211;/g, "\u2013")
    .replace(/&#8230;/g, "\u2026")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function stripTags(str) {
  return str.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeExcerpt(str) {
  return str
    .replace(/([.!?]["\u201d\u2019]?)(?=[A-Z(])/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(str, max) {
  if (str.length <= max) return str;
  return str.slice(0, max).replace(/\s+\S*$/, "") + "\u2026";
}

function matchAll(source, regex) {
  var out = [];
  var m;
  var re = new RegExp(regex.source, regex.flags.indexOf("g") === -1 ? regex.flags + "g" : regex.flags);
  while ((m = re.exec(source)) !== null) {
    out.push(m);
  }
  return out;
}

function extract(block, regex) {
  var m = block.match(regex);
  return m ? decodeEntities(m[1]) : "";
}

async function fetchText(url) {
  var res = await fetch(url, {
    headers: { "User-Agent": "learn-with-april-feed-sync/1.0 (+https://learnwithapril.com)" }
  });
  if (!res.ok) {
    throw new Error("Fetch failed (" + res.status + " " + res.statusText + ") for " + url);
  }
  return res.text();
}

async function fetchBlogPosts() {
  var xml = await fetchText(BLOG_FEED_URL);
  var items = matchAll(xml, /<item>([\s\S]*?)<\/item>/g);

  var posts = items.slice(0, MAX_ITEMS).map(function (m) {
    var block = m[1];
    var title = extract(block, /<title>([\s\S]*?)<\/title>/);
    var link = extract(block, /<link>([\s\S]*?)<\/link>/);
    var pubDate = extract(block, /<pubDate>([\s\S]*?)<\/pubDate>/);
    var rawDescription = extract(block, /<description>([\s\S]*?)<\/description>/);
    var categories = matchAll(block, /<category>([\s\S]*?)<\/category>/g).map(function (c) {
      return decodeEntities(c[1]);
    });

    var excerpt = normalizeExcerpt(
      stripTags(rawDescription).replace(/\s*The post .* appeared first on .*\.?\s*$/, "")
    );

    return {
      title: title,
      url: link,
      date: pubDate ? new Date(pubDate).toISOString() : null,
      excerpt: truncate(excerpt, 180),
      categories: categories.slice(0, 4)
    };
  });

  return posts.filter(function (p) {
    return p.title && p.url;
  });
}

async function fetchYoutubeVideos() {
  var xml;
  try {
    xml = await fetchText(YOUTUBE_FEED_URL);
  } catch (feedError) {
    console.warn("YouTube Atom feed unavailable, using the public videos page:", feedError.message);
    return fetchYoutubeVideosFromPage();
  }
  return parseYoutubeFeed(xml, MAX_ITEMS, true);
}

async function fetchSpeakingVideos() {
  var xml = await fetchText(SPEAKING_FEED_URL);
  return parseYoutubeFeed(xml, MAX_SPEAKING_ITEMS, false);
}

function parseYoutubeFeed(xml, maxItems, skipPromos) {
  var entries = matchAll(xml, /<entry>([\s\S]*?)<\/entry>/g);

  var videos = entries.map(function (m) {
    var block = m[1];
    var videoId = extract(block, /<yt:videoId>([\s\S]*?)<\/yt:videoId>/);
    var linkMatch = block.match(/<link rel="alternate" href="([^"]*)"/);
    var link = linkMatch ? decodeEntities(linkMatch[1]) : (videoId ? "https://www.youtube.com/watch?v=" + videoId : "");
    var mediaGroupMatch = block.match(/<media:group>([\s\S]*?)<\/media:group>/);
    var mediaGroup = mediaGroupMatch ? mediaGroupMatch[1] : block;
    var title = extract(mediaGroup, /<media:title>([\s\S]*?)<\/media:title>/) || extract(block, /<title>([\s\S]*?)<\/title>/);
    var thumbMatch = mediaGroup.match(/<media:thumbnail url="([^"]*)"/);
    var thumbnail = thumbMatch ? decodeEntities(thumbMatch[1]) : (videoId ? "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg" : "");
    var published = extract(block, /<published>([\s\S]*?)<\/published>/);

    return {
      title: title,
      url: link,
      videoId: videoId,
      thumbnail: thumbnail,
      date: published ? new Date(published).toISOString() : null
    };
  });

  return videos
    .filter(function (v) {
      var isShort = /youtube\.com\/shorts\//.test(v.url);
      var isPromo = skipPromos && /\bcoming (up|soon)\b/i.test(v.title);
      return v.title && v.url && v.videoId && !isShort && !isPromo;
    })
    .slice(0, maxItems);
}

async function fetchYoutubeVideosFromPage() {
  var html = await fetchText(YOUTUBE_VIDEOS_URL);
  var matches = matchAll(
    html,
    /"contentId":"([A-Za-z0-9_-]{11})"[\s\S]{0,3500}?"accessibilityContext":\{"label":"((?:\\.|[^"])*)"/g
  );
  var seen = new Set();

  return matches
    .map(function (match) {
      var videoId = match[1];
      var label;
      try {
        label = JSON.parse('"' + match[2] + '"');
      } catch {
        label = match[2];
      }
      var title = label.replace(
        /\s+\d+(?:\.\d+)?\s+(?:seconds?|minutes?|hours?)(?:,\s*\d+\s+seconds?)?$/i,
        ""
      );

      return {
        title: title,
        url: "https://www.youtube.com/watch?v=" + videoId,
        videoId: videoId,
        thumbnail: "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg",
        date: null
      };
    })
    .filter(function (video) {
      var duplicate = seen.has(video.videoId);
      seen.add(video.videoId);
      var isPromo = /\bcoming (up|soon)\b/i.test(video.title);
      return !duplicate && video.title && !isPromo;
    })
    .slice(0, MAX_ITEMS);
}

async function writeJson(filename, data) {
  var fs = await import("node:fs/promises");
  var target = new URL(filename, OUT_DIR);
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.writeFile(target, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log("Wrote " + filename + " (" + data.items.length + " items)");
}

async function main() {
  var generatedAt = new Date().toISOString();
  var failures = [];

  try {
    var posts = await fetchBlogPosts();
    await writeJson("blog-posts.json", {
      source: BLOG_FEED_URL,
      generatedAt: generatedAt,
      items: posts
    });
  } catch (err) {
    console.error("Blog feed sync failed:", err.message);
    failures.push("blog");
  }

  try {
    var videos = await fetchYoutubeVideos();
    await writeJson("youtube-videos.json", {
      source: YOUTUBE_FEED_URL,
      generatedAt: generatedAt,
      items: videos
    });
  } catch (err) {
    console.error("YouTube feed sync failed:", err.message);
    failures.push("youtube");
  }

  try {
    var talks = await fetchSpeakingVideos();
    await writeJson("speaking-videos.json", {
      source: SPEAKING_FEED_URL,
      generatedAt: generatedAt,
      items: talks
    });
  } catch (err) {
    console.error("Speaking playlist sync failed:", err.message);
    failures.push("speaking");
  }

  if (failures.length) {
    console.error("Feed sync had failures, keeping last-known-good JSON for: " + failures.join(", "));
    process.exitCode = 1;
  }
}

main();
