import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import ffmpegStatic from "ffmpeg-static";

// Load environment variables
dotenv.config();

// Bypass self-signed/proxy TLS leaf certificate rejection
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Prevent unhandled stream/socket terminations from crashing the server
process.on("uncaughtException", (err) => {
  console.warn("Uncaught Exception caught:", err.stack || err);
});
process.on("unhandledRejection", (reason: any) => {
  console.warn("Unhandled Rejection caught:", reason?.stack || reason);
});
process.on("exit", (code) => {
  console.log("Server process exiting with code:", code);
});
process.on("SIGINT", () => {
  console.log("Received SIGINT");
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("Received SIGTERM");
  process.exit(0);
});

// Keep event loop active
if (process.stdin && process.stdin.resume) {
  process.stdin.resume();
}

import { spawn, exec } from "child_process";
import fs from "fs";
import https from "https";
import http from "http";
import os from "os";


// Binary paths & environment detection
const platform = os.platform();
const arch = os.arch();

// Dynamic bin directory discovery: writable local folder or /tmp/bin in serverless (Vercel)
function getBinDir(): string {
  const localBin = path.join(process.cwd(), "bin");
  try {
    if (!fs.existsSync(localBin)) {
      fs.mkdirSync(localBin, { recursive: true });
    }
    const testFile = path.join(localBin, `.write_test_${process.pid}`);
    fs.writeFileSync(testFile, "ok");
    fs.unlinkSync(testFile);
    return localBin;
  } catch (_) {
    // Read-only filesystem (Vercel Serverless / AWS Lambda)
    const tmpBin = path.join(os.tmpdir(), "bin");
    try {
      if (!fs.existsSync(tmpBin)) {
        fs.mkdirSync(tmpBin, { recursive: true });
      }
      return tmpBin;
    } catch (_) {
      return os.tmpdir();
    }
  }
}

const binDir = getBinDir();

let ytDlpFilename = "yt-dlp";
let ytDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

if (platform === "win32") {
  ytDlpFilename = "yt-dlp.exe";
  ytDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
} else if (platform === "darwin") {
  ytDlpFilename = "yt-dlp_macos";
  ytDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos";
} else if (platform === "linux") {
  if (arch === "arm64" || arch === "aarch64") {
    ytDlpFilename = "yt-dlp_linux_aarch64";
    ytDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64";
  } else {
    ytDlpFilename = "yt-dlp_linux";
    ytDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";
  }
}

let ytDlpPath = path.join(binDir, ytDlpFilename);
let isYtDlpAvailable = false;
let resolvedFfmpegPath: string | null = null;

// Ensure binary is executable: on Linux/Vercel, if stored in read-only /var/task, copy to /tmp and chmod 0o755
function ensureExecutableBinary(srcPath: string): string {
  if (platform === "win32") return srcPath;

  if (srcPath.startsWith(os.tmpdir())) {
    try { fs.chmodSync(srcPath, 0o755); } catch (_) {}
    return srcPath;
  }

  const destPath = path.join(os.tmpdir(), path.basename(srcPath));
  try {
    if (!fs.existsSync(destPath) || fs.statSync(destPath).size !== fs.statSync(srcPath).size) {
      fs.copyFileSync(srcPath, destPath);
      fs.chmodSync(destPath, 0o755);
      console.log(`[Binary Setup] Prepared executable binary in /tmp: ${destPath}`);
    }
    return destPath;
  } catch (err: any) {
    console.warn("[Binary Setup] Could not copy binary to /tmp; trying original path:", err.message);
    try { fs.chmodSync(srcPath, 0o755); } catch (_) {}
    return srcPath;
  }
}

// Locate FFmpeg across ffmpeg-static npm package, bin directory, env vars, and standard system paths
function resolveFfmpeg(): string | null {
  if (ffmpegStatic && typeof ffmpegStatic === "string" && fs.existsSync(ffmpegStatic)) {
    return ensureExecutableBinary(ffmpegStatic);
  }

  const localBinFfmpeg = path.join(binDir, platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  if (fs.existsSync(localBinFfmpeg)) {
    return ensureExecutableBinary(localBinFfmpeg);
  }

  try {
    const fsReq = require("ffmpeg-static");
    if (fsReq && typeof fsReq === "string" && fs.existsSync(fsReq)) {
      return ensureExecutableBinary(fsReq);
    }
  } catch (_) {}

  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return ensureExecutableBinary(process.env.FFMPEG_PATH);
  }

  const candidates = [
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return ensureExecutableBinary(c);
    }
  }

  return null;
}

// Locate existing yt-dlp binary across common locations (Vercel bundled, Docker, local, system PATH)
function findExistingYtDlp(): string | null {
  if (process.env.YT_DLP_PATH && fs.existsSync(process.env.YT_DLP_PATH)) {
    return ensureExecutableBinary(process.env.YT_DLP_PATH);
  }

  const candidates = [
    // 1. Writable or local bin directory
    path.join(binDir, ytDlpFilename),
    path.join(binDir, "yt-dlp"),
    path.join(binDir, "yt-dlp.exe"),
    path.join(binDir, "yt-dlp_linux"),

    // 2. Read-only project directory (Vercel /var/task/bin)
    path.join(process.cwd(), "bin", ytDlpFilename),
    path.join(process.cwd(), "bin", "yt-dlp_linux"),
    path.join(process.cwd(), "bin", "yt-dlp"),

    // 3. Temporary directory (AWS Lambda / Vercel tmp)
    path.join(os.tmpdir(), "bin", ytDlpFilename),
    path.join(os.tmpdir(), "bin", "yt-dlp_linux"),
    path.join(os.tmpdir(), "yt-dlp_linux"),
    path.join(os.tmpdir(), "yt-dlp"),

    // 4. Docker / System locations
    "/app/bin/yt-dlp",
    "/app/bin/yt-dlp_linux",
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        const stats = fs.statSync(c);
        if (stats.size >= 1_000_000) {
          return ensureExecutableBinary(c);
        }
      } catch (_) {}
    }
  }

  return null;
}

// Download yt-dlp binary programmatically (SSL bypass for restrictive networks, writes to writable binDir)
function downloadYtDlp(): Promise<void> {
  return new Promise((resolve, reject) => {
    function download(url: string, redirectCount = 0) {
      if (redirectCount > 10) {
        reject(new Error("Too many redirects downloading yt-dlp"));
        return;
      }
      const parsedUrl = new URL(url);
      const req = https.request(parsedUrl, { method: "GET", rejectUnauthorized: false }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          download(res.headers.location, redirectCount + 1);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download yt-dlp: status ${res.statusCode}`));
          return;
        }

        const file = fs.createWriteStream(ytDlpPath);
        res.pipe(file);

        file.on("finish", () => {
          file.close(() => {
            try {
              fs.chmodSync(ytDlpPath, 0o755);
              console.log("yt-dlp binary successfully downloaded and marked as executable.");
              resolve();
            } catch (e: any) {
              reject(new Error(`Failed to set execution permissions on yt-dlp binary: ${e.message}`));
            }
          });
        });

        file.on("error", (err) => {
          fs.unlink(ytDlpPath, () => {});
          reject(err);
        });
      });
      req.on("error", (err) => {
        fs.unlink(ytDlpPath, () => {});
        reject(err);
      });
      req.end();
    }

    console.log(`Fetching latest yt-dlp release binary from GitHub: ${ytDlpUrl}`);
    download(ytDlpUrl);
  });
}

// Initialize yt-dlp & FFmpeg — awaited before requests are processed
async function initYtDlp() {
  resolvedFfmpegPath = resolveFfmpeg();
  console.log(`[Diagnostic] FFmpeg status: ${resolvedFfmpegPath ? `AVAILABLE at ${resolvedFfmpegPath}` : "NOT FOUND (separate audio/video muxing will use pre-muxed single stream fallbacks)"}`);

  try {
    const existing = findExistingYtDlp();
    if (existing) {
      ytDlpPath = existing;
      const stats = fs.statSync(ytDlpPath);
      console.log(`[Diagnostic] yt-dlp is available at: ${ytDlpPath} (${stats.size} bytes)`);
      isYtDlpAvailable = true;
      return;
    }

    console.log(`[Diagnostic] No existing yt-dlp binary found. Downloading to: ${ytDlpPath}...`);
    await downloadYtDlp();
    isYtDlpAvailable = true;
  } catch (error: any) {
    console.error("[Diagnostic] Failed to initialize yt-dlp binary:", error.message);
    isYtDlpAvailable = false;
  }
}

// Cache for Cobalt working instances per platform
interface CobaltInstancesCache {
  instances: Record<string, string[]>;
  lastFetched: number;
}

let cobaltCache: CobaltInstancesCache = {
  instances: {},
  lastFetched: 0
};

const COBALT_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Fetch working instances from cobalt.directory
async function getWorkingCobaltInstances(platform: "instagram" | "twitter" | "youtube" | "tiktok" = "youtube"): Promise<string[]> {
  if (process.env.COBALT_API_URL) {
    const custom = process.env.COBALT_API_URL.trim().replace(/\/+$/, "");
    return [custom];
  }

  const now = Date.now();
  if (cobaltCache.instances[platform] && cobaltCache.instances[platform].length > 0 && (now - cobaltCache.lastFetched < COBALT_CACHE_DURATION)) {
    console.log(`Using cached Cobalt instances list for platform: ${platform}...`);
    return cobaltCache.instances[platform];
  }

  console.log(`Fetching fresh working instances list for ${platform} from cobalt.directory...`);
  try {
    const list = await new Promise<string[]>((resolve, reject) => {
      const req = https.get("https://cobalt.directory/api/working?type=api", {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        rejectUnauthorized: false,
      }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed && parsed.data) {
              const d = parsed.data;
              let platformList: string[] = d[platform] || [];
              if (platform === "youtube" && d["youtube-shorts"]) {
                platformList = Array.from(new Set([...platformList, ...d["youtube-shorts"]]));
              }
              const crossList: string[] = Array.from(new Set([...(d.youtube || []), ...(d.tiktok || []), ...(d.instagram || []), ...(d.twitter || [])]));
              
              const generalPool: string[] = Object.entries(d)
                .filter(([key]) => key !== "Frontend")
                .flatMap(([, val]) => val as string[]);

              const merged = Array.from(
                new Set<string>([...platformList, ...crossList, ...generalPool])
              );

              // Known instances that require JWT auth — skip these
              const jwtRequired = new Set([
                "https://api.qwkuns.me",
                "https://api-cobalt.eversiege.network",
                "https://cobaltapi.squair.xyz",
                "https://nuko-c.meowing.de",
                "https://cobalt.alpha.wolfy.love",
                "https://grapefruit.clxxped.lol",
                "https://cobalt.omega.wolfy.love",
                "https://lime.clxxped.lol",
                "https://subito-c.meowing.de",
                "https://rue-cobalt.xenon.zone",
                "https://melon.clxxped.lol",
                "https://cobaltapi.cjs.nz",
                "https://kityune.imput.net",
                "https://blossom.imput.net",
                "https://nachos.imput.net",
                "https://sunny.imput.net",
                "https://kitty.tame.gg",
              ]);

              const cleaned = merged
                .map((u: string) => {
                  let clean = u.trim();
                  if (clean.endsWith("/api/json")) clean = clean.slice(0, -9);
                  else if (clean.endsWith("/api/json/")) clean = clean.slice(0, -10);
                  if (clean.endsWith("/")) clean = clean.slice(0, -1);
                  return clean;
                })
                .filter((u) => Boolean(u) && !jwtRequired.has(u));

              console.log(`cobalt.directory: ${platformList.length} ${platform}-capable, ${cleaned.length} usable instances`);
              resolve(cleaned);
            } else {
              reject(new Error("Invalid response format from cobalt.directory"));
            }
          } catch (e: any) {
            reject(e);
          }
        });
      });

      req.on("error", reject);
      req.setTimeout(2500, () => {
        req.destroy();
        reject(new Error("Timeout fetching cobalt instances list"));
      });
    });

    if (list && list.length > 0) {
      cobaltCache.instances[platform] = list;
      cobaltCache.lastFetched = now;
      console.log(`Successfully fetched and cached ${list.length} Cobalt instances for ${platform}.`);
      return list;
    }
  } catch (error: any) {
    console.warn("Failed to fetch working instances from cobalt.directory:", error.message);
  }

  // Static fallback — open (non-JWT) Cobalt instances
  const fallbackList = [
    "https://cobalt.canine.tools",
    "https://api.cobalt.liubquanti.click",
    "https://cobalt-api.kwiatekm.tokyo",
  ];
  console.log("Using hardcoded Cobalt fallback list.");
  return fallbackList;
}

// Write a Netscape cookie file for yt-dlp if session cookie is available
function getInstagramCookieFile(): string | null {
  const sessionId = process.env.INSTAGRAM_SESSION_COOKIE;
  if (!sessionId) return null;

  try {
    const cookieFilePath = path.join(os.tmpdir(), "ig_cookies.txt");
    const cookieContent = [
      "# Netscape HTTP Cookie File",
      "# This is generated automatically by QuickSave",
      "",
      // domain, includeSubdomains, path, secure, expiry, name, value
      `.instagram.com\tTRUE\t/\tTRUE\t2147483647\tsessionid\t${sessionId}`,
    ].join("\n");
    fs.writeFileSync(cookieFilePath, cookieContent, "utf8");
    return cookieFilePath;
  } catch (e: any) {
    console.warn("Failed to write Instagram cookie file:", e.message);
    return null;
  }
}

// Write a Netscape cookie file for Twitter/X if auth token is available
function getTwitterCookieFile(): string | null {
  const authToken = process.env.TWITTER_AUTH_TOKEN || process.env.TWITTER_SESSION_COOKIE || process.env.X_AUTH_TOKEN;
  const ct0 = process.env.TWITTER_CT0 || process.env.X_CT0 || "";
  if (!authToken) return null;

  try {
    const cookieFilePath = path.join(os.tmpdir(), "twitter_cookies.txt");
    const cookieContent = [
      "# Netscape HTTP Cookie File",
      "# This is generated automatically by QuickSave",
      "",
      `.twitter.com\tTRUE\t/\tTRUE\t2147483647\tauth_token\t${authToken}`,
      `.x.com\tTRUE\t/\tTRUE\t2147483647\tauth_token\t${authToken}`,
      ct0 ? `.twitter.com\tTRUE\t/\tTRUE\t2147483647\tct0\t${ct0}` : "",
      ct0 ? `.x.com\tTRUE\t/\tTRUE\t2147483647\tct0\t${ct0}` : "",
    ].filter(Boolean).join("\n");
    fs.writeFileSync(cookieFilePath, cookieContent, "utf8");
    return cookieFilePath;
  } catch (e: any) {
    console.warn("Failed to write Twitter cookie file:", e.message);
    return null;
  }
}

// Write a Netscape cookie file for YouTube if session cookie or base64 cookies are provided via env
function getYouTubeCookieFile(): string | null {
  const cookieStr = process.env.YOUTUBE_COOKIE;
  const cookieB64 = process.env.YOUTUBE_COOKIES_BASE64 || process.env.YOUTUBE_COOKIE_BASE64;

  let content = "";
  if (cookieB64) {
    try {
      content = Buffer.from(cookieB64, "base64").toString("utf8");
    } catch (_) {}
  } else if (cookieStr) {
    content = cookieStr;
  }

  if (!content || !content.trim()) return null;

  try {
    const cookieFilePath = path.join(os.tmpdir(), "youtube_cookies.txt");
    fs.writeFileSync(cookieFilePath, content, "utf8");
    return cookieFilePath;
  } catch (e: any) {
    console.warn("Failed to write YouTube cookie file:", e.message);
    return null;
  }
}

function isSafeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("169.254.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      hostname === "metadata.google.internal" ||
      hostname === "instance-data"
    ) {
      return false;
    }
    return true;
  } catch (_) {
    return false;
  }
}

// Quick probe to check if a remote media URL is actually reachable and returns 200/206/30x
function checkUpstreamAlive(targetUrl: string, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (!isSafeUrl(targetUrl)) return resolve(false);
      const parsed = new URL(targetUrl);
      const protocol = parsed.protocol === "https:" ? https : http;
      const req = protocol.request(
        parsed,
        {
          method: "HEAD",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          rejectUnauthorized: false,
          timeout: timeoutMs,
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
            resolve(true);
          } else {
            resolve(false);
          }
        }
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    } catch (_) {
      resolve(false);
    }
  });
}

function detectPlatform(url: string): "twitter" | "instagram" | "youtube" | "tiktok" | "facebook" | "reddit" | "pinterest" | "threads" | "twitch" | "vimeo" | "other" {
  const lower = url.toLowerCase();
  if (/twitter\.com|x\.com|t\.co/.test(lower)) return "twitter";
  if (/instagram\.com/.test(lower)) return "instagram";
  if (/youtube\.com|youtu\.be/.test(lower)) return "youtube";
  if (/tiktok\.com|tiktokv\.com|douyin\.com/.test(lower)) return "tiktok";
  if (/facebook\.com|fb\.watch|fb\.com/.test(lower)) return "facebook";
  if (/reddit\.com|redd\.it/.test(lower)) return "reddit";
  if (/pinterest\.com|pin\.it/.test(lower)) return "pinterest";
  if (/threads\.net/.test(lower)) return "threads";
  if (/twitch\.tv/.test(lower)) return "twitch";
  if (/vimeo\.com/.test(lower)) return "vimeo";
  return "other";
}

function normalizeMediaUrl(inputUrl: string): string {
  try {
    let clean = inputUrl.trim();
    // Expand YouTube shortlinks (youtu.be/ID?si=...) to canonical URLs
    const ytShortMatch = clean.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (ytShortMatch) {
      return `https://www.youtube.com/watch?v=${ytShortMatch[1]}`;
    }
    const ytLongMatch = clean.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    if (ytLongMatch) {
      return `https://www.youtube.com/watch?v=${ytLongMatch[1]}`;
    }
    const twitterMatch = clean.match(/(?:twitter\.com|x\.com)\/(?:#!\/)?(?:i\/web\/|i\/)?(?:[a-zA-Z0-9_]+)\/status\/(\d+)/);
    if (twitterMatch) {
      return `https://x.com/i/status/${twitterMatch[1]}`;
    }
    const instaMatch = clean.match(/(?:instagram\.com)\/(p|reel|tv)\/([a-zA-Z0-9_-]+)/);
    if (instaMatch) {
      return `https://www.instagram.com/${instaMatch[1]}/${instaMatch[2]}/`;
    }
    return clean.split("?")[0];
  } catch (_) {
    return inputUrl.trim();
  }
}

// Specialized high-speed TikTok extractor (watermark-free HD MP4, MP3 audio, and photo carousels)
async function extractTikTokMedia(
  rawUrl: string,
  downloadMode = "auto",
  videoQuality = "1080"
): Promise<{
  status: "stream" | "picker";
  url?: string;
  previewUrl?: string;
  fallbackUrl?: string;
  title: string;
  thumb: string;
  filename?: string;
  picker?: Array<{
    url: string;
    previewUrl: string;
    fallbackUrl: string;
    type: "video" | "audio" | "photo";
    thumb: string;
  }>;
}> {
  const cleanUrl = rawUrl.trim();
  const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}&hd=1`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json"
    }
  });
  const data = await res.json();
  if (data.code !== 0 || !data.data) {
    throw new Error(data.msg || "Failed to extract TikTok media via TikWM");
  }

  const item = data.data;
  const rawTitle = item.title || item.desc || "tiktok_video";
  const cleanTitle = rawTitle.replace(/[^a-zA-Z0-9_.-]/g, "_").substring(0, 60) || "tiktok_video";
  const isAudio = downloadMode === "audio";

  // Check if it's a photo gallery / carousel post
  if (Array.isArray(item.images) && item.images.length > 0) {
    const picker = item.images.map((imgUrl: string, idx: number) => {
      const safeFilename = `${cleanTitle}_photo_${idx + 1}.jpg`;
      const streamUrl = `/api/stream?url=${encodeURIComponent(imgUrl)}&filename=${encodeURIComponent(safeFilename)}&src=${encodeURIComponent(cleanUrl)}`;
      return {
        url: streamUrl,
        previewUrl: streamUrl,
        fallbackUrl: streamUrl,
        type: "photo" as const,
        thumb: imgUrl
      };
    });

    if (item.music) {
      const safeAudioFilename = `${cleanTitle}_audio.mp3`;
      const musicStreamUrl = `/api/stream?url=${encodeURIComponent(item.music)}&filename=${encodeURIComponent(safeAudioFilename)}&src=${encodeURIComponent(cleanUrl)}`;
      picker.unshift({
        url: musicStreamUrl,
        previewUrl: musicStreamUrl,
        fallbackUrl: musicStreamUrl,
        type: "audio" as const,
        thumb: item.cover || ""
      });
    }

    return {
      status: "picker",
      picker,
      title: rawTitle,
      thumb: item.cover || ""
    };
  }

  const mediaUrl = isAudio
    ? (item.music || item.play)
    : (item.hdplay || item.play || item.wmplay);

  if (!mediaUrl) {
    throw new Error("No downloadable media URL found in TikTok response.");
  }

  const safeFilename = `${cleanTitle}.${isAudio ? "mp3" : "mp4"}`;
  const streamUrl = `/api/stream?url=${encodeURIComponent(mediaUrl)}&filename=${encodeURIComponent(safeFilename)}&src=${encodeURIComponent(cleanUrl)}`;
  const fallbackUrl = `/api/media?src=${encodeURIComponent(cleanUrl)}&quality=720&mode=${downloadMode || "auto"}&filename=${encodeURIComponent(safeFilename)}`;

  return {
    status: "stream",
    url: streamUrl,
    previewUrl: streamUrl,
    fallbackUrl,
    title: rawTitle,
    thumb: item.cover || "",
    filename: safeFilename
  };
}

interface StreamContext {
  headers?: Record<string, string>;
  cookies?: string;
  timestamp: number;
}

const streamContextCache = new Map<string, StreamContext>();

// In-Memory LRU/TTL Cache for media metadata (15-minute TTL)
interface CachedMediaInfo {
  info: any;
  timestamp: number;
}

const mediaInfoCache = new Map<string, CachedMediaInfo>();
const MEDIA_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getMediaCacheKey(rawUrl: string): string {
  const url = normalizeMediaUrl(rawUrl);
  const ytMatch = url.match(/(?:v=|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return `yt_${ytMatch[1]}`;
  }
  const ttMatch = url.match(/video\/(\d+)/);
  if (ttMatch) {
    return `tt_${ttMatch[1]}`;
  }
  const twMatch = url.match(/status\/(\d+)/);
  if (twMatch) {
    return `tw_${twMatch[1]}`;
  }
  return url;
}

// Query media info with yt-dlp (with in-memory cache and mobile client args)
function getMediaInfo(rawUrl: string, bypassCache = false): Promise<any> {
  const cacheKey = getMediaCacheKey(rawUrl);
  if (!bypassCache) {
    const cached = mediaInfoCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < MEDIA_CACHE_TTL)) {
      console.log(`[Media Cache] HIT for ${cacheKey} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
      return Promise.resolve(cached.info);
    }
  }

  return new Promise((resolve, reject) => {
    if (!isYtDlpAvailable) {
      reject(new Error("yt-dlp binary is currently not available."));
      return;
    }

    const url = normalizeMediaUrl(rawUrl);
    const args: string[] = ["-4"];

    // Use session cookie file if available (from env variable)
    const igCookieFile = getInstagramCookieFile();
    if (igCookieFile && /instagram\.com/.test(url)) {
      args.push("--cookies", igCookieFile);
      console.log("Using Instagram session cookie from INSTAGRAM_SESSION_COOKIE env variable");
    }

    const twitterCookieFile = getTwitterCookieFile();
    if (twitterCookieFile && (/twitter\.com|x\.com/.test(url))) {
      args.push("--cookies", twitterCookieFile);
      console.log("Using Twitter session cookie from TWITTER_AUTH_TOKEN env variable");
    }

    const ytCookieFile = getYouTubeCookieFile();
    if (ytCookieFile && (/youtube\.com|youtu\.be/.test(url))) {
      args.push("--cookies", ytCookieFile);
    }

    const ytProxy = process.env.YOUTUBE_PROXY || process.env.HTTP_PROXY;
    if (ytProxy && (/youtube\.com|youtu\.be/.test(url))) {
      args.push("--proxy", ytProxy);
    }

    const isTiktok = /tiktok\.com/.test(url);
    const isYoutube = /youtube\.com|youtu\.be/.test(url);

    args.push(
      "-J",
      "--no-playlist",
      "--skip-download",
      "--no-check-certificate",
      "--no-warnings",
      "--socket-timeout", "8"
    );

    if (resolvedFfmpegPath) {
      args.push("--ffmpeg-location", resolvedFfmpegPath);
    }

    args.push("--js-runtimes", "node");

    if (isTiktok) {
      args.push("--extractor-args", "tiktok:api_hostname=api16-normal-c-useast1a.tiktokv.com");
    }

    if (isYoutube) {
      args.push("--extractor-args", "youtube:player_client=android,web");
    }

    args.push(url);

    console.log(`Running: ${ytDlpPath} ${args.join(" ")}`);
    const proc = spawn(ytDlpPath, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";

    proc.on("error", (err) => {
      console.error("Failed to start yt-dlp process:", err);
      reject(err);
    });

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      const trimmed = stdout.trim();
      if (trimmed && trimmed !== "null") {
        try {
          const info = JSON.parse(trimmed);
          if (info && typeof info === "object" && (info.title || info.formats || info.entries)) {
            mediaInfoCache.set(cacheKey, { info, timestamp: Date.now() });
            if (mediaInfoCache.size > 200) {
              const now = Date.now();
              for (const [k, v] of mediaInfoCache.entries()) {
                if (now - v.timestamp > MEDIA_CACHE_TTL) {
                  mediaInfoCache.delete(k);
                }
              }
            }
            return resolve(info);
          }
        } catch (_) {}
      }

      if (code !== 0 || !trimmed || trimmed === "null") {
        console.error("yt-dlp stderr:", stderr.substring(0, 500));
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code} (output: ${trimmed.substring(0, 60)})`));
        return;
      }

      reject(new Error("No valid metadata returned by yt-dlp"));
    });
  });
}

// Reusable media pipe / downloader using yt-dlp (with H.264/AAC browser-compatible streaming)
function pipeYtDlpMedia(
  src: string,
  req: express.Request,
  res: express.Response,
  options: {
    isDownload?: boolean;
    isAudio?: boolean;
    targetHeight?: number;
    safeFilename?: string;
  }
) {
  if (!isYtDlpAvailable) {
    if (!res.headersSent) {
      res.status(503).json({ error: "Downloader service currently initializing. Please try again shortly." });
    }
    return;
  }

  const isDownload = options.isDownload || false;
  const isAudio = options.isAudio || false;
  const targetHeight = options.targetHeight || 1080;
  const safeFilename = options.safeFilename || (isAudio ? "audio.mp3" : "video.mp4");
  const isTiktok = /tiktok\.com/.test(src);
  const isYoutube = /youtube\.com|youtu\.be/.test(src);

  // Intelligent format selector:
  // Video: prioritize universal H.264 (AVC1) for video & AAC (m4a) for audio up to targetHeight,
  // then fallback to general video+audio merge, then pre-muxed, then best.
  // Audio: prioritize native MP3/M4A, or convert to MP3 via ffmpeg if available.
  let formatStr = "";
  if (isAudio) {
    formatStr = resolvedFfmpegPath
      ? "ba[ext=mp3]/ba[ext=m4a]/ba[acodec^=mp4a]/ba/b"
      : "ba[ext=m4a]/ba[ext=mp3]/ba/b";
  } else {
    formatStr = resolvedFfmpegPath
      ? `bv*[height<=${targetHeight}][vcodec^=avc1]+ba[acodec^=mp4a]/bv*[height<=${targetHeight}][vcodec^=avc]+ba[ext=m4a]/bv*[height<=${targetHeight}][ext=mp4]+ba[ext=m4a]/bv*[height<=${targetHeight}]+ba/b[height<=${targetHeight}]/bv*+ba/b`
      : `b[height<=${targetHeight}][ext=mp4]/b[height<=${targetHeight}]/b/best`;
  }

  const contentType = isAudio ? "audio/mpeg" : "video/mp4";
  const disposition = isDownload
    ? `attachment; filename="${encodeURIComponent(safeFilename)}"`
    : `inline; filename="${encodeURIComponent(safeFilename)}"`;

  // Download and merge to a temporary file, then stream with Range support and auto-cleanup
  const tempFile = path.join(
    os.tmpdir(),
    `quicksave_${Date.now()}_${Math.random().toString(36).slice(2)}.${isAudio ? "mp3" : "mp4"}`
  );

  const args: string[] = [
    "-4",
    "--no-playlist",
    "--no-check-certificate",
    "--no-warnings",
    "--socket-timeout", "15",
    "-f", formatStr,
  ];

  if (isAudio && resolvedFfmpegPath) {
    args.push("-x", "--audio-format", "mp3");
  } else if (!isAudio && resolvedFfmpegPath) {
    args.push("--merge-output-format", "mp4");
  }

  if (resolvedFfmpegPath) {
    args.push("--ffmpeg-location", resolvedFfmpegPath);
  }

  args.push("--js-runtimes", "node");

  if (isTiktok) {
    args.push("--extractor-args", "tiktok:api_hostname=api16-normal-c-useast1a.tiktokv.com");
  }

  if (isYoutube) {
    args.push("--extractor-args", "youtube:player_client=android,web");
  }

  const igCookieFile = getInstagramCookieFile();
  if (igCookieFile && src.includes("instagram")) {
    args.push("--cookies", igCookieFile);
  }

  const twitterCookieFile = getTwitterCookieFile();
  if (twitterCookieFile && (/twitter\.com|x\.com/.test(src))) {
    args.push("--cookies", twitterCookieFile);
  }

  const ytCookieFile = getYouTubeCookieFile();
  if (ytCookieFile && (/youtube\.com|youtu\.be/.test(src))) {
    args.push("--cookies", ytCookieFile);
  }

  const ytProxy = process.env.YOUTUBE_PROXY || process.env.HTTP_PROXY;
  if (ytProxy && (/youtube\.com|youtu\.be/.test(src))) {
    args.push("--proxy", ytProxy);
  }

  args.push("-o", tempFile);
  args.push(src);

  console.log(`[Media Pipe] Starting download for: ${src.substring(0, 60)} (${isAudio ? "Audio MP3" : `${targetHeight}p MP4`}) -> ${tempFile}`);

  const proc = spawn(ytDlpPath, args, { windowsHide: true });
  let stderr = "";

  proc.stderr.on("data", (data: Buffer) => {
    stderr += data.toString();
  });

  // Client abort handling
  const cleanup = () => {
    if (!proc.killed) {
      try { proc.kill("SIGTERM"); } catch (_) {}
    }
    if (fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (_) {}
    }
  };

  req.on("close", () => {
    if (!res.writableEnded) {
      console.log(`[Media Pipe] Client disconnected prematurely for: ${src.substring(0, 50)}`);
      cleanup();
    }
  });

  proc.on("close", (code: number | null) => {
    if (code !== 0 || !fs.existsSync(tempFile)) {
      console.error(`[Media Pipe] yt-dlp exited with code ${code}. Stderr: ${stderr.substring(0, 400)}`);
      if (!res.headersSent) {
        res.status(502).json({
          error: "Media processing failed",
          details: "Unable to download or process media from the upstream provider. Please try another quality."
        });
      }
      cleanup();
      return;
    }

    try {
      const stats = fs.statSync(tempFile);
      const totalSize = stats.size;

      if (totalSize === 0) {
        if (!res.headersSent) {
          res.status(502).json({ error: "Empty media produced", details: "Upstream media stream was empty." });
        }
        cleanup();
        return;
      }

      console.log(`[Media Pipe] Download & merge completed: ${totalSize} bytes. Streaming to client...`);

      // Support HTTP Range Requests (seekable preview and download resume)
      const range = req.headers.range;
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${totalSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": contentType,
          "Content-Disposition": disposition,
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600",
        });

        const fileStream = fs.createReadStream(tempFile, { start, end });
        fileStream.pipe(res);
        fileStream.on("close", () => {
          setTimeout(cleanup, 5000);
        });
      } else {
        res.writeHead(200, {
          "Content-Length": totalSize,
          "Content-Type": contentType,
          "Content-Disposition": disposition,
          "Accept-Ranges": "bytes",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600",
        });

        const fileStream = fs.createReadStream(tempFile);
        fileStream.pipe(res);
        fileStream.on("close", cleanup);
      }
    } catch (e: any) {
      console.error("[Media Pipe] Error serving file:", e.message);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream media file", details: e.message });
      }
      cleanup();
    }
  });
}

// NOTE: initYtDlp() is now awaited inside startServer() before the server listens.

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Gemini AI client safely (lazy loaded on request)
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY environment variable is not configured. Please add it in the Secrets panel in AI Studio.");
      }
      aiClient = new GoogleGenAI({ apiKey });
    }
    return aiClient;
  }

  // Diagnostic endpoint to inspect runtime environment, binaries, and test execution
  app.get("/api/diagnostic", async (req, res) => {
    const testUrl = (req.query.url as string) || "https://youtu.be/-H_I2T7yWQM";
    const result: any = {
      timestamp: new Date().toISOString(),
      platform: os.platform(),
      arch: os.arch(),
      isYtDlpAvailable,
      ytDlpPath,
      resolvedFfmpegPath,
      cacheSize: mediaInfoCache.size,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        PORT: process.env.PORT,
        YOUTUBE_PROXY: Boolean(process.env.YOUTUBE_PROXY),
      },
    };

    try {
      result.binaryExists = fs.existsSync(ytDlpPath);
      result.binarySize = result.binaryExists ? fs.statSync(ytDlpPath).size : null;
    } catch (e: any) {
      result.binaryStatError = e.message;
    }

    try {
      const versionOutput = await new Promise<string>((resolve, reject) => {
        const proc = spawn(ytDlpPath, ["--version"]);
        let out = "";
        let err = "";
        proc.stdout.on("data", (d: Buffer) => out += d);
        proc.stderr.on("data", (d: Buffer) => err += d);
        proc.on("close", (code: number | null) => code === 0 ? resolve(out.trim()) : reject(new Error(err || `code ${code}`)));
        proc.on("error", reject);
      });
      result.ytDlpVersion = versionOutput;
    } catch (e: any) {
      result.versionError = e.message;
    }

    if (req.query.test === "1" || req.query.test === "true") {
      const rawStart = Date.now();
      const normUrl = normalizeMediaUrl(testUrl);
      const testArgs = [
        "-4",
        "-J",
        "--no-playlist",
        "--skip-download",
        "--no-check-certificate",
        "--no-warnings",
        "--socket-timeout", "8",
        "--extractor-args", "youtube:player_client=android,web",
        normUrl
      ];

      try {
        const rawProc = spawn(ytDlpPath, testArgs, { windowsHide: true });
        let rawOut = "";
        let rawErr = "";
        rawProc.stdout.on("data", (d: Buffer) => rawOut += d.toString());
        rawProc.stderr.on("data", (d: Buffer) => rawErr += d.toString());
        const code = await new Promise<number | null>((resolve) => rawProc.on("close", resolve));
        result.rawRun = {
          durationMs: Date.now() - rawStart,
          code,
          normUrl,
          args: testArgs,
          stdoutLength: rawOut.length,
          stdoutSample: rawOut.substring(0, 300),
          stderr: rawErr.substring(0, 1000),
        };
      } catch (err: any) {
        result.rawRun = { error: err.message };
      }

      try {
        const t0 = Date.now();
        const info = await getMediaInfo(testUrl, true);
        result.testResult = {
          success: true,
          durationMs: Date.now() - t0,
          type: typeof info,
          keys: info ? Object.keys(info).slice(0, 15) : null,
          title: info?.title ?? null,
          formatsCount: info?.formats?.length ?? null,
          extractor: info?.extractor ?? null,
          sample: JSON.stringify(info).substring(0, 300),
        };
      } catch (e: any) {
        result.testResult = {
          success: false,
          error: e.message,
        };
      }
    }

    res.json(result);
  });

  // Test individual player clients on the server
  app.get("/api/test-client", async (req, res) => {
    const client = (req.query.client as string) || "web";
    const targetUrl = (req.query.url as string) || "https://youtu.be/-H_I2T7yWQM";
    const verbose = req.query.verbose === "1" || req.query.verbose === "true";
    const extraArgs = (req.query.extra_args as string) || "";
    const cookie = (req.query.cookie as string) || "";
    const normUrl = normalizeMediaUrl(targetUrl);
    const args = [
      "-4",
      "--no-playlist",
      "--skip-download",
      "--no-check-certificate",
      "--no-warnings",
      "--socket-timeout", "10",
    ];

    if (verbose) {
      args.push("-v");
    } else {
      args.push("-J");
    }

    if (client !== "none") {
      args.push("--extractor-args", `youtube:player_client=${client}`);
    }

    if (extraArgs) {
      args.push(...extraArgs.split(" ").filter(Boolean));
    }

    let tempCookiePath: string | null = null;
    if (cookie) {
      tempCookiePath = path.join(os.tmpdir(), `test_cookie_${Date.now()}.txt`);
      fs.writeFileSync(tempCookiePath, cookie, "utf8");
      args.push("--cookies", tempCookiePath);
    } else {
      const ytCookieFile = getYouTubeCookieFile();
      if (ytCookieFile) {
        args.push("--cookies", ytCookieFile);
      }
    }

    args.push(normUrl);

    const start = Date.now();
    try {
      const proc = spawn(ytDlpPath, args, { windowsHide: true });
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (d: Buffer) => stdout += d.toString());
      proc.stderr.on("data", (d: Buffer) => stderr += d.toString());
      const code = await new Promise<number | null>((resolve) => proc.on("close", resolve));
      if (tempCookiePath && fs.existsSync(tempCookiePath)) {
        try { fs.unlinkSync(tempCookiePath); } catch (_) {}
      }
      let parsed: any = null;
      try { parsed = JSON.parse(stdout); } catch (_) {}
      res.json({
        durationMs: Date.now() - start,
        code,
        client,
        args,
        stdoutLength: stdout.length,
        hasTitle: Boolean(parsed?.title),
        title: parsed?.title,
        formatsCount: parsed?.formats?.length,
        stdoutSample: stdout.substring(0, 500),
        stderr: stderr.trim()
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message, durationMs: Date.now() - start });
    }
  });

  // API Route: Fast Media Extraction & Download (Sub-second response pipeline)
  app.post("/api/download", async (req, res) => {
    const { url: rawUrl, videoQuality, downloadMode, audioFormat } = req.body;
    let lastExtractionError: string | null = null;
    try {
      if (!rawUrl) {
        return res.status(400).json({ error: "Missing required field: url" });
      }

      if (!isSafeUrl(rawUrl)) {
        return res.status(400).json({ error: "Invalid URL provided. Only public http/https links are supported." });
      }

      const url = normalizeMediaUrl(rawUrl);
      const platform = detectPlatform(url);
      const isYoutube = platform === "youtube";

      let parsedHostname = "unknown";
      try {
        parsedHostname = new URL(url).hostname;
      } catch (_) {}

      // Safe Diagnostic Logging (Step 6)
      console.log(`[Extractor Diagnostic] Request received:`);
      console.log(`  - Platform: ${platform}`);
      console.log(`  - Hostname: ${parsedHostname}`);
      console.log(`  - Quality: ${videoQuality || "1080"}`);
      console.log(`  - Mode: ${downloadMode || "auto"}`);
      console.log(`  - yt-dlp: ${isYtDlpAvailable ? `AVAILABLE (${ytDlpPath})` : "NOT FOUND"}`);
      console.log(`  - FFmpeg: ${resolvedFfmpegPath ? `AVAILABLE (${resolvedFfmpegPath})` : "NOT FOUND"}`);
      console.log(`  - Environment: ${process.env.VERCEL ? "Vercel Serverless" : "Container/Node"}`);

      // ── Specialized Strategy 0: Direct High-Speed TikTok Media Extraction ─────────
      if (platform === "tiktok") {
        try {
          console.log(`Extracting TikTok media via fast engine for: ${url}...`);
          const tiktokResult = await extractTikTokMedia(rawUrl, downloadMode, videoQuality);
          console.log(`TikTok extraction successful: ${tiktokResult.title?.substring(0, 40)}`);
          return res.json(tiktokResult);
        } catch (ttErr: any) {
          console.warn("Direct TikTok extraction failed, falling back to Cobalt/yt-dlp:", ttErr.message);
        }
      }

      let ytDlpAlreadyAttempted = false;

      // ── Specialized Strategy 1: Dedicated YouTube Pipeline via yt-dlp ──────────────
      if (platform === "youtube") {
        ytDlpAlreadyAttempted = true;
        let ytDlpSuccess = false;
        if (isYtDlpAvailable) {
          try {
            console.log(`[Extractor Diagnostic] Extracting YouTube media metadata via yt-dlp for: ${url}...`);
            const info = await getMediaInfo(url);
            if (info) {
              const rawTitle = info.title || "YouTube Video";
              const cleanTitle = rawTitle
                .replace(/[/\\?%*:|"<>]/g, "_")
                .replace(/\s+/g, "_")
                .substring(0, 80) || "youtube_video";

              const isAudio = downloadMode === "audio";
              const targetHeight = parseInt(videoQuality as string) || 1080;
              const ext = isAudio ? "mp3" : "mp4";
              const safeFilename = `${cleanTitle}.${ext}`;

              let thumb = info.thumbnail || info.thumbnails?.[0]?.url || "";
              const ytMatch = url.match(/(?:v=|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
              if (!thumb && ytMatch) {
                thumb = `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`;
              }

              // Check if direct progressive stream is available in formats
              let directCdnStreamUrl: string | null = null;
              if (Array.isArray(info.formats)) {
                if (isAudio) {
                  const audioFmt = info.formats.find((f: any) => f.vcodec === "none" && f.acodec !== "none" && f.url && (f.ext === "m4a" || f.ext === "mp3" || (f.acodec && f.acodec.includes("mp4a"))))
                    || info.formats.find((f: any) => f.vcodec === "none" && f.acodec !== "none" && f.url);
                  if (audioFmt?.url) {
                    directCdnStreamUrl = audioFmt.url;
                  }
                } else {
                  const progressiveFormats = info.formats
                    .filter((f: any) => f.vcodec !== "none" && f.acodec !== "none" && f.url && (f.ext === "mp4" || f.container === "mp4"))
                    .sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
                  if (progressiveFormats.length > 0) {
                    const matched = progressiveFormats.find((f: any) => (f.height || 0) <= targetHeight) || progressiveFormats[0];
                    if (matched?.url) {
                      directCdnStreamUrl = matched.url;
                    }
                  }
                }
              }

              // Direct CDN streaming: stream immediately with Range support and zero server disk bottleneck
              const useDirectProxy = Boolean(directCdnStreamUrl);
              const proxyUrl = directCdnStreamUrl
                ? `/api/stream?url=${encodeURIComponent(directCdnStreamUrl)}&filename=${encodeURIComponent(safeFilename)}&src=${encodeURIComponent(url)}`
                : `/api/media?src=${encodeURIComponent(url)}&quality=${targetHeight}&mode=${downloadMode || "auto"}&filename=${encodeURIComponent(safeFilename)}`;

              const mediaPipeUrl = `/api/media?src=${encodeURIComponent(url)}&quality=${targetHeight}&mode=${downloadMode || "auto"}&filename=${encodeURIComponent(safeFilename)}`;
              const fallbackMediaUrl = `/api/media?src=${encodeURIComponent(url)}&quality=720&mode=${downloadMode || "auto"}&filename=${encodeURIComponent(safeFilename)}`;

              // Cache stream headers and cookies for proxy streaming
              const mediaCookies = info.cookies || "";
              const mediaHeaders = info.http_headers || {};
              const contextItem: StreamContext = {
                headers: mediaHeaders,
                cookies: mediaCookies,
                timestamp: Date.now(),
              };
              if (url) streamContextCache.set(url, contextItem);
              if (directCdnStreamUrl) streamContextCache.set(directCdnStreamUrl, contextItem);

              console.log(`[Extractor Diagnostic] YouTube yt-dlp SUCCESS: "${rawTitle}" (Direct Stream: ${directCdnStreamUrl ? "YES" : "NO"})`);
              ytDlpSuccess = true;

              return res.json({
                status: "stream",
                url: useDirectProxy ? proxyUrl : mediaPipeUrl,
                previewUrl: useDirectProxy ? proxyUrl : mediaPipeUrl,
                fallbackUrl: fallbackMediaUrl,
                title: rawTitle,
                thumb,
                filename: safeFilename,
              });
            }
          } catch (ytErr: any) {
            lastExtractionError = ytErr.message || String(ytErr);
            const errCategory = ytErr.message?.includes("Sign in")
              ? "BOT_VERIFICATION"
              : ytErr.message?.includes("Private video")
              ? "PRIVATE_RESTRICTED"
              : ytErr.message?.includes("not available")
              ? "BINARY_UNAVAILABLE"
              : "GENERAL_EXTRACTION_ERROR";
            console.warn(`[Extractor Diagnostic] yt-dlp extraction failed (${errCategory}):`, ytErr.message);
            console.log("[Extractor Diagnostic] Falling back to Cobalt parallel racing...");
          }
        } else {
          console.warn("[Extractor Diagnostic] yt-dlp binary is not available. Falling back to Cobalt parallel racing...");
        }

        // If yt-dlp didn't succeed, do NOT return 422 here! Fall through to Cobalt race below!
      }

      // ── Helper: POST to single Cobalt instance with fast timeout ──────────────
      const postToCobalt = (
        targetUrl: string,
        payload: any,
        timeoutMs = 2500
      ): Promise<{ ok: boolean; status?: number; data?: any; errText?: string }> => {
        return new Promise((resolve) => {
          let settled = false;
          let req2: any = null;
          const timer = setTimeout(() => {
            if (!settled) {
              settled = true;
              if (req2) req2.destroy();
              resolve({ ok: false, errText: "Timeout" });
            }
          }, timeoutMs);

          try {
            const parsedUrl = new URL(targetUrl);
            const bodyStr = JSON.stringify(payload);
            req2 = https.request(
              parsedUrl,
              {
                method: "POST",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                  "Content-Length": Buffer.byteLength(bodyStr),
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
                rejectUnauthorized: false,
              },
              (res2) => {
                let respBody = "";
                res2.on("data", (chunk) => (respBody += chunk));
                res2.on("end", () => {
                  if (!settled) {
                    settled = true;
                    clearTimeout(timer);
                    let parsedJson: any = null;
                    try {
                      parsedJson = JSON.parse(respBody);
                    } catch (_) {}

                    if (res2.statusCode && res2.statusCode >= 200 && res2.statusCode < 300 && parsedJson) {
                      resolve({ ok: true, status: res2.statusCode, data: parsedJson });
                    } else if (parsedJson) {
                      resolve({ ok: true, status: res2.statusCode, data: parsedJson });
                    } else {
                      resolve({ ok: false, status: res2.statusCode, errText: respBody.substring(0, 200) });
                    }
                  }
                });
              }
            );
            req2.on("error", (e) => {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                resolve({ ok: false, errText: e.message });
              }
            });
            req2.write(bodyStr);
            req2.end();
          } catch (e: any) {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              resolve({ ok: false, errText: e.message });
            }
          }
        });
      };

      // ── Strategy 1: High-Speed Parallel Cobalt Racing (sub-second target) ─────
      const cobaltPlatform = (platform === "twitter" || platform === "instagram" || platform === "tiktok") ? platform : "youtube";
      const endpoints = await getWorkingCobaltInstances(cobaltPlatform);
      const topEndpoints = endpoints.slice(0, 8);

      const modernPayload: any = { url };
      if (downloadMode === "audio") {
        modernPayload.downloadMode = "audio";
        modernPayload.audioFormat = audioFormat || "mp3";
      } else {
        modernPayload.videoQuality = videoQuality || "1080";
      }

      console.log(`Racing ${topEndpoints.length} fast Cobalt endpoints in parallel for ${platform}...`);

      const racePromises = topEndpoints.map(async (endpoint) => {
        // Try simple payload first for maximum Cobalt compatibility
        const res = await postToCobalt(endpoint, { url }, 2000);
        if (res.ok && res.data && (res.data.url || res.data.picker)) {
          return { endpoint, data: res.data };
        }
        // Fallback to modern payload on same endpoint
        const res2 = await postToCobalt(endpoint, modernPayload, 2000);
        if (res2.ok && res2.data && (res2.data.url || res2.data.picker)) {
          return { endpoint, data: res2.data };
        }
        throw new Error(res.errText || "No media");
      });

      try {
        const winner = await Promise.any(racePromises);
        console.log(`Sub-second Cobalt win from: ${winner.endpoint}`);

        if (winner.data.url) {
          // Verify winner URL is alive before returning
          const isAlive = await checkUpstreamAlive(winner.data.url, 1200);
          if (isAlive) {
            const safeFilename = `${(winner.data.filename || "video").replace(/[^a-zA-Z0-9_.-]/g, "_")}.${downloadMode === "audio" ? "mp3" : "mp4"}`;
            let thumb = winner.data.thumb || winner.data.cover || "";
            if (!thumb && isYoutube) {
              const ytMatch = url.match(/(?:v=|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
              if (ytMatch) thumb = `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`;
            }

            const streamUrl = `/api/stream?url=${encodeURIComponent(winner.data.url)}&filename=${encodeURIComponent(safeFilename)}&src=${encodeURIComponent(url)}`;
            const fallbackUrl = `/api/media?src=${encodeURIComponent(url)}&quality=720&mode=${downloadMode || "auto"}&filename=${encodeURIComponent(safeFilename)}`;

            return res.json({
              status: "stream",
              url: streamUrl,
              previewUrl: streamUrl,
              fallbackUrl,
              title: winner.data.filename || "video",
              thumb,
              filename: safeFilename,
            });
          } else {
            console.log(`Cobalt stream URL from ${winner.endpoint} failed liveness check; falling back to yt-dlp.`);
          }
        }

        if (winner.data.picker) {
          const mappedPicker = winner.data.picker.map((item: any, idx: number) => {
            const safeFilename = `media_${idx + 1}.${item.type === "video" ? "mp4" : "jpg"}`;
            const itemStreamUrl = `/api/stream?url=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(safeFilename)}&src=${encodeURIComponent(url)}`;
            const itemFallbackUrl = `/api/media?src=${encodeURIComponent(url)}&quality=720&mode=${downloadMode || "auto"}&filename=${encodeURIComponent(safeFilename)}`;
            return {
              ...item,
              url: itemStreamUrl,
              previewUrl: itemStreamUrl,
              fallbackUrl: itemFallbackUrl,
              thumb: item.thumb || item.cover || winner.data.thumb || winner.data.cover || "",
            };
          });
          return res.json({
            status: "picker",
            picker: mappedPicker,
            title: winner.data.filename || "video",
            thumb: winner.data.thumb || winner.data.cover || "",
          });
        }
      } catch (_) {
        console.log("Parallel Cobalt race yielded no immediate hit, proceeding to fast yt-dlp extraction...");
      }

      // ── Strategy 2: Fast yt-dlp Direct CDN URL Extraction Fallback ───────────
      if (isYtDlpAvailable && !ytDlpAlreadyAttempted) {
        try {
          const info = await getMediaInfo(url);
          if (info) {
            const cleanTitle = (info.title || "video").replace(/[^a-zA-Z0-9_.-]/g, "_").substring(0, 50);

            // Handle multi-item playlists / carousels
            if (info._type === "playlist" || (info.entries && info.entries.length > 0)) {
              const entries = info.entries || [];
              const picker = entries.map((entry: any, index: number) => {
                const entryExt = entry.ext || "mp4";
                const safeFilename = `${cleanTitle}_part${index + 1}.${entryExt}`;
                const entryDirectUrl = entry.url || entry.requested_downloads?.[0]?.url;
                const streamUrl = entryDirectUrl && !entryDirectUrl.includes(".m3u8") && !entryDirectUrl.includes(".mpd")
                  ? `/api/stream?url=${encodeURIComponent(entryDirectUrl)}&filename=${encodeURIComponent(safeFilename)}&src=${encodeURIComponent(url)}`
                  : `/api/media?src=${encodeURIComponent(entry.webpage_url || url)}&quality=${videoQuality || "1080"}&mode=${downloadMode || "auto"}&filename=${encodeURIComponent(safeFilename)}`;
                const fallbackUrl = `/api/media?src=${encodeURIComponent(entry.webpage_url || url)}&quality=720&mode=${downloadMode || "auto"}&filename=${encodeURIComponent(safeFilename)}`;
                return {
                  url: streamUrl,
                  previewUrl: streamUrl,
                  fallbackUrl,
                  type: entry.vcodec === "none" ? "audio" : "video",
                  thumb: entry.thumbnail || entry.thumbnails?.[0]?.url || info.thumbnail || "",
                };
              });
              return res.json({ status: "picker", picker });
            }

            const safeFilename = `${cleanTitle}.${downloadMode === "audio" ? "mp3" : "mp4"}`;
            const fallbackMediaUrl = `/api/media?src=${encodeURIComponent(url)}&quality=720&mode=${downloadMode || "auto"}&filename=${encodeURIComponent(safeFilename)}`;

            // Extract best direct download CDN URL (unthrottled high-quality download)
            const isH264 = (f: any) => {
              const vc = (f.vcodec || "").toLowerCase();
              return (vc.includes("avc") || vc.includes("h264")) && !vc.includes("hevc") && !vc.includes("265") && !vc.includes("bytevc");
            };
            const isBrowserNative = (f: any) => {
              const vc = (f.vcodec || "").toLowerCase();
              return !vc.includes("hevc") && !vc.includes("265") && !vc.includes("bytevc");
            };

            const directDownloadFormats = info.formats?.filter(
              (f: any) => f.vcodec !== "none" && f.acodec !== "none" && f.url && f.ext === "mp4" && !f.url.includes(".m3u8") && !f.url.includes(".mpd")
            ) || [];

            const directCdnDownloadUrl =
              directDownloadFormats[directDownloadFormats.length - 1]?.url ||
              info.url ||
              info.requested_downloads?.[0]?.url ||
              info.formats?.filter((f: any) => f.vcodec !== "none" && f.url && !f.url.includes(".m3u8") && !f.url.includes(".mpd"))?.pop()?.url;

            // Codec-optimized preview selection (prefer H.264 MP4 with audio for 100% browser preview playback)
            const h264PreviewFormat = directDownloadFormats.filter((f: any) => isH264(f)).pop();
            const nativePreviewFormat = directDownloadFormats.filter((f: any) => isBrowserNative(f)).pop();
            const bestPreviewFormat = h264PreviewFormat || nativePreviewFormat || directDownloadFormats[0];

            // Cache cookies and request headers for this media extraction
            const mediaCookies = info.cookies || "";
            const mediaHeaders = info.http_headers || {};
            const contextItem: StreamContext = {
              headers: mediaHeaders,
              cookies: mediaCookies,
              timestamp: Date.now(),
            };

            if (url) streamContextCache.set(url, contextItem);
            if (bestPreviewFormat?.url) streamContextCache.set(bestPreviewFormat.url, contextItem);
            if (directCdnDownloadUrl) streamContextCache.set(directCdnDownloadUrl, contextItem);

            let previewUrl = fallbackMediaUrl;
            if (bestPreviewFormat && bestPreviewFormat.url && !bestPreviewFormat.url.includes(".m3u8") && !bestPreviewFormat.url.includes(".mpd")) {
              previewUrl = `/api/stream?url=${encodeURIComponent(bestPreviewFormat.url)}&filename=${encodeURIComponent(safeFilename)}&src=${encodeURIComponent(url)}`;
            }

            let downloadUrl = fallbackMediaUrl;
            if (directCdnDownloadUrl && !directCdnDownloadUrl.includes(".m3u8") && !directCdnDownloadUrl.includes(".mpd")) {
              downloadUrl = `/api/stream?url=${encodeURIComponent(directCdnDownloadUrl)}&filename=${encodeURIComponent(safeFilename)}&src=${encodeURIComponent(url)}`;
            }

            let thumb = info.thumbnail || info.thumbnails?.[0]?.url || "";
            if (!thumb && isYoutube) {
              const ytMatch = url.match(/(?:v=|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
              if (ytMatch) thumb = `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`;
            }

            console.log(`[Preview] yt-dlp metadata ready. Preview stream: ${previewUrl.substring(0, 60)}, Download stream: ${downloadUrl.substring(0, 60)}`);

            return res.json({
              status: "stream",
              url: downloadUrl,
              previewUrl,
              fallbackUrl: fallbackMediaUrl,
              title: info.title || "video",
              thumb,
              filename: safeFilename,
            });
          }
        } catch (ytDlpError: any) {
          console.warn("yt-dlp fast extraction failed:", ytDlpError.message);
        }
      }

      if (platform === "twitter") {
        return res.status(422).json({
          error: "Twitter/X extraction failed",
          details: "Unable to extract media from this Twitter/X post. Please verify that the post contains a video or GIF."
        });
      } else if (platform === "tiktok") {
        return res.status(422).json({
          error: "TikTok extraction failed",
          details: "Unable to extract media from this TikTok URL. Please verify the link and try again."
        });
      } else if (platform === "youtube") {
        return res.status(422).json({
          error: "YouTube extraction failed",
          details: lastExtractionError || "No compatible media stream was found for this YouTube link. Please verify the URL."
        });
      } else {
        return res.status(422).json({
          error: "Media extraction failed",
          details: "Unable to extract media stream from the provided URL. Please verify the link and try again."
        });
      }
    } catch (error: any) {
      console.error("Download route error:", error);
      return res.status(500).json({
        error: "Media extraction error",
        details: error.message || "An unexpected error occurred while communicating with downloader services.",
      });
    }
  });

  // Direct yt-dlp Media Streaming Endpoint
  app.get("/api/media", (req, res) => {
    const { src, quality, mode, filename, dl } = req.query;

    if (!src || typeof src !== "string") {
      return res.status(400).send("Missing src parameter");
    }

    if (!isSafeUrl(src)) {
      return res.status(400).send("Invalid media source URL");
    }

    const isDownload = dl === "1" || dl === "true";
    const isAudio = mode === "audio";
    const targetHeight = parseInt(quality as string) || 1080;
    const safeFilename = (filename as string) || (isAudio ? "audio.mp3" : "video.mp4");

    pipeYtDlpMedia(src, req, res, {
      isDownload,
      isAudio,
      targetHeight,
      safeFilename,
    });
  });

  // CDN Proxy Streaming Endpoint (used for Cobalt & direct CDN URLs)
  // Range-aware: supports seek & inline preview with auto-fallback to yt-dlp on upstream failure
  app.get("/api/stream", async (req, res) => {
    const { url, filename, dl, src, mode, quality } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).send("Missing URL parameter");
    }

    if (!isSafeUrl(url)) {
      return res.status(400).send("Invalid media URL");
    }

    const isDownload = dl === "1" || dl === "true";
    const isAudio = mode === "audio" || (typeof filename === "string" && filename.endsWith(".mp3"));
    const safeFilename = (filename as string) || (isAudio ? "audio.mp3" : "video.mp4");
    const originalSrc = typeof src === "string" && isSafeUrl(src) ? src : null;

    console.log(`[Stream Proxy] Piping media (${isDownload ? "DOWNLOAD" : "PREVIEW"}): ${url.substring(0, 60)}...`);

    const lowerUrl = url.toLowerCase();
    let referer = "https://www.youtube.com/";
    if (lowerUrl.includes("twimg") || lowerUrl.includes("twitter") || lowerUrl.includes("x.com") || lowerUrl.includes("t.co")) {
      referer = "https://twitter.com/";
    } else if (lowerUrl.includes("instagram") || lowerUrl.includes("cdninstagram") || lowerUrl.includes("fbcdn")) {
      referer = "https://www.instagram.com/";
    } else if (lowerUrl.includes("tiktok") || lowerUrl.includes("tiktokv") || lowerUrl.includes("tiktokcdn") || lowerUrl.includes("byteoversea") || lowerUrl.includes("muscdn") || lowerUrl.includes("ibyteimg")) {
      referer = "https://www.tiktok.com/";
    } else if (lowerUrl.includes("facebook") || lowerUrl.includes("fb.com")) {
      referer = "https://www.facebook.com/";
    } else if (lowerUrl.includes("reddit") || lowerUrl.includes("redd.it")) {
      referer = "https://www.reddit.com/";
    }

    // Look up cached session headers and cookies
    const cachedContext = streamContextCache.get(url) || (originalSrc ? streamContextCache.get(originalSrc) : undefined);

    const clientHeaders: Record<string, string> = {
      "User-Agent":
        cachedContext?.headers?.["User-Agent"] ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
      "Referer": cachedContext?.headers?.["Referer"] || referer,
      "Accept": "*/*",
    };

    if (cachedContext?.cookies) {
      clientHeaders["Cookie"] = cachedContext.cookies;
    }

    if (req.headers.range) {
      clientHeaders["range"] = req.headers.range as string;
    }

    const fallbackToYtDlp = () => {
      if (originalSrc && isYtDlpAvailable && !res.headersSent) {
        console.log(`[Preview Fallback] Upstream failed, seamlessly streaming via yt-dlp media pipe for: ${originalSrc.substring(0, 60)}...`);
        return pipeYtDlpMedia(originalSrc, req, res, {
          isDownload,
          isAudio,
          safeFilename,
          targetHeight: parseInt(quality as string) || 720,
        });
      } else if (!res.headersSent) {
        res.status(502).send("Media stream unavailable");
      }
    };

    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === "https:" ? https : http;

      const reqOpts: any = {
        headers: clientHeaders,
        rejectUnauthorized: false,
        timeout: 8000,
      };

      const request = protocol.get(url, reqOpts, (response) => {
        // Handle redirect if the CDN returned 301/302/307/308
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirectUrl = response.headers.location;
          if (isSafeUrl(redirectUrl)) {
            const dlFlag = isDownload ? "&dl=1" : "";
            const srcParam = originalSrc ? `&src=${encodeURIComponent(originalSrc)}` : "";
            res.redirect(`/api/stream?url=${encodeURIComponent(redirectUrl)}&filename=${encodeURIComponent(safeFilename)}${dlFlag}${srcParam}`);
            return;
          }
        }

        // If upstream returned error (403, 404, 410, 500, etc.), fall back internally
        if (response.statusCode && (response.statusCode >= 400 || response.statusCode < 200)) {
          console.warn(`[Stream Proxy] Upstream returned status ${response.statusCode} for ${url.substring(0, 60)}`);
          return fallbackToYtDlp();
        }

        let rawContentType = response.headers["content-type"];
        let contentType = isAudio ? "audio/mpeg" : "video/mp4";
        if (rawContentType && !rawContentType.includes("octet-stream") && !rawContentType.includes("text/plain") && !rawContentType.includes("text/html")) {
          contentType = rawContentType;
        } else if (safeFilename.endsWith(".mp3")) {
          contentType = "audio/mpeg";
        } else if (safeFilename.endsWith(".webm")) {
          contentType = "video/webm";
        } else if (safeFilename.endsWith(".jpg") || safeFilename.endsWith(".jpeg")) {
          contentType = "image/jpeg";
        } else if (safeFilename.endsWith(".png")) {
          contentType = "image/png";
        }

        const headers: Record<string, string> = {
          "Content-Type": contentType,
          "Accept-Ranges": response.headers["accept-ranges"] || "bytes",
          "Cache-Control": "public, max-age=3600",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Range",
          "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
        };

        const contentLength = response.headers["content-length"] || response.headers["estimated-content-length"];
        if (contentLength) headers["Content-Length"] = contentLength as string;
        if (response.headers["content-range"]) headers["Content-Range"] = response.headers["content-range"];

        if (isDownload) {
          headers["Content-Disposition"] = `attachment; filename="${safeFilename}"`;
        } else {
          headers["Content-Disposition"] = `inline; filename="${safeFilename}"`;
        }

        res.writeHead(response.statusCode || 200, headers);

        response.on("error", (err) => {
          console.warn("[Stream Proxy] Incoming chunk error:", err.message);
          res.end();
        });

        res.on("error", (err) => {
          console.warn("[Stream Proxy] Outgoing client error:", err.message);
          request.destroy();
        });

        response.pipe(res);
      });

      request.on("timeout", () => {
        request.destroy();
        console.warn(`[Stream Proxy] Request timed out for: ${url.substring(0, 60)}`);
        fallbackToYtDlp();
      });

      request.on("error", (err) => {
        console.warn("[Stream Proxy] Upstream connection error:", err.message);
        fallbackToYtDlp();
      });

      res.on("close", () => {
        request.destroy();
      });
    } catch (e: any) {
      console.error("[Stream Proxy] Invalid URL passed:", e.message);
      fallbackToYtDlp();
    }
  });

  // API Route: AI Social Media & Assistant Companion using Gemini
  app.post("/api/generate-ai-content", async (req, res) => {
    try {
      const { url, description, title, mode } = req.body;

      if (!url) {
        return res.status(400).json({ error: "Missing required URL" });
      }

      const isTwitter = /twitter\.com|x\.com/.test(url);
      const platform = isTwitter ? "Twitter (X)" : "Instagram";

      const ai = getAiClient();

      let prompt = "";
      if (mode === "social-bundle") {
        prompt = `
          The user is downloading a video from ${platform} (Link: ${url}).
          ${title ? `Video Title/Context: "${title}"` : ""}
          ${description ? `Additional Details: "${description}"` : ""}

          Generate a social media marketing kit for this video content. Return exactly a JSON block matching the schema below.
          Do not include any markdown format tags other than valid JSON.
          
          Required fields:
          1. "caption": A catchy, engaging Instagram/TikTok style caption with spacing and linebreaks (include 3-5 high-converting hashtags).
          2. "tweet": A concise, engaging Twitter (X) post (must be under 260 characters including hashtags).
          3. "hashtags": An array of 10 relevant, trending hashtags (without the hash symbol).
          4. "summary": A short, elegant 2-3 sentence summary of what this video likely contains or teaches.
          5. "hook": A powerful "hook" sentence that can be used as overlay text or the first line of a post to grab attention.

          Format your output strictly as a JSON object, e.g.:
          {
            "caption": "...",
            "tweet": "...",
            "hashtags": ["...", "..."],
            "summary": "...",
            "hook": "..."
          }
        `;
      } else {
        prompt = `
          The user is downloading a video from ${platform} (Link: ${url}).
          ${title ? `Video Title/Context: "${title}"` : ""}
          ${description ? `Additional Details: "${description}"` : ""}

          Generate a 3-sentence summary of the content and why it would go viral or provide value to viewers.
          Return directly as plain text. No markdown.
        `;
      }

      // Call Gemini 2.0 Flash
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: mode === "social-bundle" ? { responseMimeType: "application/json" } : undefined,
      });

      const text = response.text || "";

      if (mode === "social-bundle") {
        try {
          const parsed = JSON.parse(text.trim());
          return res.json(parsed);
        } catch (parseError) {
          // If JSON parse fails, return structured fields parsed manually or raw
          return res.json({
            caption: text,
            tweet: text.substring(0, 250),
            hashtags: ["viral", "trending", "video"],
            summary: "Content generated successfully with minor parsing issues.",
            hook: "Check this out!"
          });
        }
      } else {
        return res.json({ result: text });
      }

    } catch (error: any) {
      console.error("Gemini content generation error:", error);
      return res.status(500).json({
        error: error.message || "An error occurred while generating AI content.",
      });
    }
  });

// Export app and initYtDlp for Vercel Serverless / external wrappers
export { app, initYtDlp };
export default app;

async function startServer() {
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // Wait for yt-dlp to be ready BEFORE accepting any requests
  console.log("Initializing yt-dlp binary...");
  await initYtDlp();
  console.log(`yt-dlp ready: ${isYtDlpAvailable ? "YES" : "NO (will use fallback)"}`);

  // Serve static assets or mount Vite in development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind to port if not running in Vercel Serverless Function
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

// Only launch standalone daemon server when NOT running inside Vercel Serverless
if (!process.env.VERCEL) {
  startServer().catch((error) => {
    console.error("Failed to start fullstack server:", error);
    process.exit(1);
  });
}
