import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

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


// Binary paths
const binDir = path.join(process.cwd(), "bin");
const platform = os.platform();
const arch = os.arch();

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

const ytDlpPath = path.join(binDir, ytDlpFilename);
let isYtDlpAvailable = false;

// Ensure bin directory exists
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

// Download yt-dlp binary programmatically (SSL bypass for restrictive networks)
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

// Initialize yt-dlp — awaited before server starts accepting requests
async function initYtDlp() {
  try {
    if (fs.existsSync(ytDlpPath)) {
      const stats = fs.statSync(ytDlpPath);
      // Treat anything under 1MB as a partial/corrupt download
      if (stats.size < 1_000_000) {
        console.warn(`Local yt-dlp binary is too small (${stats.size} bytes — likely partial). Deleting and re-downloading...`);
        try { fs.unlinkSync(ytDlpPath); } catch (_) {}
        await downloadYtDlp();
      } else {
        console.log(`yt-dlp is already available locally at: ${ytDlpPath} (${stats.size} bytes)`);
      }
      isYtDlpAvailable = true;
    } else {
      await downloadYtDlp();
      isYtDlpAvailable = true;
    }
  } catch (error: any) {
    console.error("Failed to initialize yt-dlp binary:", error.message);
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
      req.setTimeout(5000, () => {
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
    "https://api.cobalt.liubquanti.click",
    "https://dog.kittycat.boo",
    "https://cobaltapi.kittycat.boo",
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
    const ytShortMatch = clean.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (ytShortMatch) {
      return `https://www.youtube.com/watch?v=${ytShortMatch[1]}`;
    }
    const ytLongMatch = clean.match(/(?:youtube\.com\/watch\?.*v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/);
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

// Query media info with yt-dlp
function getMediaInfo(rawUrl: string): Promise<any> {
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

    const isYoutube = /youtube\.com|youtu\.be/.test(url);
    const isTiktok = /tiktok\.com/.test(url);

    args.push(
      "--dump-single-json",
      "--no-playlist",
      "--ignore-errors",
      "--no-check-certificate",
      "--no-warnings"
    );

    if (isYoutube) {
      args.push("--extractor-args", "youtube:player_client=android,web");
    }

    if (isTiktok) {
      args.push("--extractor-args", "tiktok:api_hostname=api16-normal-c-useast1a.tiktokv.com");
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
      if (code !== 0) {
        console.error("yt-dlp stderr:", stderr.substring(0, 500));
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
        return;
      }

      try {
        const info = JSON.parse(stdout);
        resolve(info);
      } catch (err: any) {
        reject(new Error("Failed to parse yt-dlp metadata JSON: " + err.message));
      }
    });
  });
}

// Reusable media pipe using yt-dlp (with H.264/AAC browser-compatible streaming)
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
      res.status(503).send("yt-dlp not available for direct media streaming");
    }
    return;
  }

  const isDownload = options.isDownload || false;
  const isAudio = options.isAudio || false;
  const targetHeight = options.targetHeight || 720;
  const safeFilename = options.safeFilename || (isAudio ? "audio.mp3" : "video.mp4");

  // Single pre-muxed format selector prioritizing universal H.264/AVC1 for video & AAC/MP3 for audio
  const formatStr = isAudio
    ? "bestaudio[ext=mp3]/bestaudio[ext=m4a]/bestaudio/ba"
    : `best[vcodec^=avc1][height<=${targetHeight}][ext=mp4]/best[vcodec^=h264][height<=${targetHeight}][ext=mp4]/best[height<=${targetHeight}][ext=mp4]/best[vcodec^=avc1][ext=mp4]/best[vcodec^=h264][ext=mp4]/best[ext=mp4]/best/b`;

  const isYoutube = /youtube\.com|youtu\.be/.test(src);
  const isTiktok = /tiktok\.com/.test(src);

  const args: string[] = [
    "-4",
    "--no-playlist",
    "--no-check-certificate",
    "--no-warnings",
    "--ignore-errors",
    "-f", formatStr,
    "-o", "-",
  ];

  if (isYoutube) {
    args.push("--extractor-args", "youtube:player_client=web,android");
  }

  if (isTiktok) {
    args.push("--extractor-args", "tiktok:api_hostname=api16-normal-c-useast1a.tiktokv.com");
  }

  const igCookieFile = getInstagramCookieFile();
  if (igCookieFile && src.includes("instagram")) {
    args.push("--cookies", igCookieFile);
  }

  const twitterCookieFile = getTwitterCookieFile();
  if (twitterCookieFile && (/twitter\.com|x\.com/.test(src))) {
    args.push("--cookies", twitterCookieFile);
  }

  args.push(src);

  console.log(`[Preview] yt-dlp media streaming pipe (${isAudio ? "audio" : `video@${targetHeight}p`}) for: ${src.substring(0, 60)}...`);
  const proc = spawn(ytDlpPath, args, { windowsHide: true });

  let dataStarted = false;

  proc.stdout.on("data", (chunk: Buffer) => {
    if (!dataStarted) {
      dataStarted = true;
      const contentType = isAudio ? "audio/mpeg" : "video/mp4";
      const disposition = isDownload
        ? `attachment; filename="${safeFilename}"`
        : `inline; filename="${safeFilename}"`;
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
      });
    }
    res.write(chunk);
  });

  proc.stdout.on("end", () => {
    if (!dataStarted && !res.headersSent) {
      res.status(502).send("yt-dlp produced no media output. The URL may be unavailable or geo-blocked.");
    } else {
      res.end();
    }
  });

  proc.stderr.on("data", (data: Buffer) => {
    const msg = data.toString();
    if (!msg.startsWith("[download]") && !msg.startsWith("[info]") && !msg.startsWith("[youtube]")) {
      console.warn("[Preview] yt-dlp stderr:", msg.substring(0, 250));
    }
  });

  proc.on("error", (err: Error) => {
    console.error("[Preview] yt-dlp spawn error:", err);
    if (!res.headersSent) {
      res.status(500).send("Failed to start yt-dlp media process");
    }
  });

  proc.on("close", (code: number | null) => {
    console.log(`[Preview] yt-dlp stream pipe exited with code ${code}`);
    if (!res.writableEnded) res.end();
  });

  res.on("close", () => {
    if (!proc.killed) {
      proc.kill("SIGTERM");
    }
  });
}

// NOTE: initYtDlp() is now awaited inside startServer() before the server listens.

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // Wait for yt-dlp to be ready BEFORE accepting any requests
  console.log("Initializing yt-dlp binary...");
  await initYtDlp();
  console.log(`yt-dlp ready: ${isYtDlpAvailable ? "YES" : "NO (will use fallback)"}`);

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

  // API Route: Fast Media Extraction & Download (Sub-second response pipeline)
  app.post("/api/download", async (req, res) => {
    const { url: rawUrl, videoQuality, downloadMode, audioFormat } = req.body;
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

      console.log(`Processing media request for (${platform}): ${url} (Mode: ${downloadMode || "auto"}, Quality: ${videoQuality || "1080"})`);

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
      if (isYtDlpAvailable) {
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
        throw new Error("Unable to extract media from this Twitter/X post. Please verify that the post contains a video or GIF. (If the post is sensitive/age-restricted, Twitter/X may require authentication cookies).");
      } else if (platform === "tiktok") {
        throw new Error("Unable to extract media from this TikTok URL. Please verify the link and try again.");
      } else {
        throw new Error("Unable to extract direct media stream. Please verify the URL and try again.");
      }
    } catch (error: any) {
      console.error("Download route error:", error);
      return res.status(500).json({
        error: error.message || "An error occurred while communicating with downloader services.",
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
    const targetHeight = parseInt(quality as string) || 720;
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

  // Serve static assets or mount Vite in development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Bind to port 3000 and 0.0.0.0 (required for Cloud Run routing)
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start fullstack server:", error);
  process.exit(1);
});
