import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

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
    const twitterMatch = clean.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/status\/(\d+)/);
    if (twitterMatch) {
      return `https://x.com/${twitterMatch[1]}/status/${twitterMatch[2]}`;
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
    const cookieFile = getInstagramCookieFile();
    if (cookieFile) {
      args.push("--cookies", cookieFile);
      console.log("Using Instagram session cookie from INSTAGRAM_SESSION_COOKIE env variable");
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

      const url = normalizeMediaUrl(rawUrl);

      // Basic validation for URL
      const isTwitter = /twitter\.com|x\.com/.test(url);
      const isInstagram = /instagram\.com/.test(url);
      const isYoutube = /youtube\.com|youtu\.be/.test(url);
      const isTiktok = /tiktok\.com/.test(url);

      if (!isTwitter && !isInstagram && !isYoutube && !isTiktok) {
        return res.status(400).json({
          error: "Invalid URL. Twitter (X), Instagram, YouTube, and TikTok URLs are supported.",
        });
      }

      let detectedPlatform: "instagram" | "twitter" | "youtube" | "tiktok" = "youtube";
      if (isTwitter) detectedPlatform = "twitter";
      else if (isInstagram) detectedPlatform = "instagram";
      else if (isTiktok) detectedPlatform = "tiktok";
      else if (isYoutube) detectedPlatform = "youtube";

      console.log(`Processing fast download request for (${detectedPlatform}): ${url} (Mode: ${downloadMode || "auto"}, Quality: ${videoQuality || "1080"})`);

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
      const endpoints = await getWorkingCobaltInstances(detectedPlatform);
      const topEndpoints = endpoints.slice(0, 8);

      const modernPayload: any = { url };
      if (downloadMode === "audio") {
        modernPayload.downloadMode = "audio";
        modernPayload.audioFormat = audioFormat || "mp3";
      } else {
        modernPayload.videoQuality = videoQuality || "1080";
      }

      console.log(`Racing ${topEndpoints.length} fast Cobalt endpoints in parallel...`);

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
          const safeFilename = `${(winner.data.filename || "video").replace(/[^a-zA-Z0-9_.-]/g, "_")}.${downloadMode === "audio" ? "mp3" : "mp4"}`;
          let thumb = winner.data.thumb || winner.data.cover || "";
          if (!thumb && isYoutube) {
            const ytMatch = url.match(/(?:v=|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
            if (ytMatch) thumb = `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`;
          }
          return res.json({
            status: "stream",
            url: `/api/stream?url=${encodeURIComponent(winner.data.url)}&filename=${encodeURIComponent(safeFilename)}`,
            title: winner.data.filename || "video",
            thumb,
            filename: safeFilename,
          });
        }

        if (winner.data.picker) {
          const mappedPicker = winner.data.picker.map((item: any, idx: number) => {
            const safeFilename = `media_${idx + 1}.${item.type === "video" ? "mp4" : "jpg"}`;
            return {
              ...item,
              url: `/api/stream?url=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(safeFilename)}`,
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

            if (info._type === "playlist" || (info.entries && info.entries.length > 0)) {
              const entries = info.entries || [];
              const picker = entries.map((entry: any, index: number) => {
                const entryExt = entry.ext || "mp4";
                const safeFilename = `${cleanTitle}_part${index + 1}.${entryExt}`;
                const entryDirectUrl = entry.url || entry.requested_downloads?.[0]?.url;
                const streamUrl = entryDirectUrl && !entryDirectUrl.includes(".m3u8") && !entryDirectUrl.includes(".mpd")
                  ? `/api/stream?url=${encodeURIComponent(entryDirectUrl)}&filename=${encodeURIComponent(safeFilename)}`
                  : `/api/media?src=${encodeURIComponent(entry.webpage_url || url)}&quality=${videoQuality || "1080"}&mode=${downloadMode || "auto"}&filename=${encodeURIComponent(safeFilename)}`;
                return {
                  url: streamUrl,
                  type: entry.vcodec === "none" ? "audio" : "video",
                  thumb: entry.thumbnail || entry.thumbnails?.[0]?.url || info.thumbnail || "",
                };
              });
              return res.json({ status: "picker", picker });
            }

            const safeFilename = `${cleanTitle}.${downloadMode === "audio" ? "mp3" : "mp4"}`;

            // Prefer pre-muxed combined formats (with both video + audio) for direct browser playback
            const directCdnUrl =
              info.formats?.filter((f: any) => f.vcodec !== "none" && f.acodec !== "none" && f.url && f.ext === "mp4" && !f.url.includes(".m3u8") && !f.url.includes(".mpd"))?.pop()?.url ||
              info.url ||
              info.requested_downloads?.[0]?.url ||
              info.formats?.filter((f: any) => f.vcodec !== "none" && f.url && !f.url.includes(".m3u8") && !f.url.includes(".mpd"))?.pop()?.url;

            if (directCdnUrl && !directCdnUrl.includes(".m3u8") && !directCdnUrl.includes(".mpd")) {
              console.log(`Direct CDN URL extracted (${directCdnUrl.substring(0, 60)}...) — routing to instant proxy stream!`);
              return res.json({
                status: "stream",
                url: `/api/stream?url=${encodeURIComponent(directCdnUrl)}&filename=${encodeURIComponent(safeFilename)}`,
                title: info.title || "video",
                thumb: info.thumbnail || info.thumbnails?.[0]?.url || (isYoutube ? `https://i.ytimg.com/vi/${url.match(/(?:v=|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1] || ""}/hqdefault.jpg` : ""),
                filename: safeFilename,
              });
            }

            // Fallback for complex DASH/HLS streams needing yt-dlp pipe
            console.log(`yt-dlp metadata ready — routing to media pipe for: ${url.substring(0, 60)}`);
            return res.json({
              status: "stream",
              url: `/api/media?src=${encodeURIComponent(url)}&quality=${videoQuality || "1080"}&mode=${downloadMode || "auto"}&filename=${encodeURIComponent(safeFilename)}`,
              title: info.title || "video",
              thumb: info.thumbnail || info.thumbnails?.[0]?.url || (isYoutube ? `https://i.ytimg.com/vi/${url.match(/(?:v=|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1] || ""}/hqdefault.jpg` : ""),
              filename: safeFilename,
            });
          }
        } catch (ytDlpError: any) {
          console.warn("yt-dlp fast extraction failed:", ytDlpError.message);
        }
      }

      throw new Error("Unable to extract direct video stream. Please verify the URL and try again.");
    } catch (error: any) {
      console.error("Download route error:", error);
      return res.status(500).json({
        error: error.message || "An error occurred while communicating with downloader services.",
      });
    }
  });

  // Direct yt-dlp Media Streaming Endpoint
  // Spawns yt-dlp with -o - to pipe audio/video directly to the browser.
  // Prioritises single pre-muxed streams (no ffmpeg needed).
  app.get("/api/media", (req, res) => {
    const { src, quality, mode, filename, dl } = req.query;

    if (!src || typeof src !== "string") {
      return res.status(400).send("Missing src parameter");
    }

    if (!isYtDlpAvailable) {
      return res.status(503).send("yt-dlp not available for direct media streaming");
    }

    const isDownload = dl === "1" || dl === "true";
    const isAudio = mode === "audio";
    const targetHeight = parseInt(quality as string) || 1080;
    const safeFilename = (filename as string) || (isAudio ? "audio.mp3" : "video.mp4");

    // Build format selector string — prioritise pre-muxed single stream (no ffmpeg required)
    const formatStr = isAudio
      ? "bestaudio[ext=mp3]/bestaudio[ext=m4a]/bestaudio/ba"
      : `best[height<=${targetHeight}][ext=mp4]/best[ext=mp4]/b[ext=mp4]/best/b`;

    const isYoutube = /youtube\.com|youtu\.be/.test(src);
    const isTiktok = /tiktok\.com/.test(src);

    const args: string[] = [
      "-4",
      "--no-playlist",
      "--no-check-certificate",
      "--no-warnings",
      "-f", formatStr,
      "-o", "-",  // pipe output to stdout
    ];

    if (isYoutube) {
      args.push("--extractor-args", "youtube:player_client=web,android");
    }

    if (isTiktok) {
      args.push("--extractor-args", "tiktok:api_hostname=api16-normal-c-useast1a.tiktokv.com");
    }

    // Inject Instagram session cookie if available
    const cookieFile = getInstagramCookieFile();
    if (cookieFile && src.includes("instagram")) {
      args.push("--cookies", cookieFile);
    }

    args.push(src);

    console.log(`/api/media: yt-dlp streaming ${isAudio ? "audio" : `video@${targetHeight}p`} for ${src.substring(0, 60)}...`);
    const proc = spawn(ytDlpPath, args, { windowsHide: true });

    let dataStarted = false;

    proc.stdout.on("data", (chunk: Buffer) => {
      if (!dataStarted) {
        dataStarted = true;
        // Send headers on first data chunk
        const contentType = isAudio ? "audio/mpeg" : "video/mp4";
        const disposition = isDownload
          ? `attachment; filename="${safeFilename}"`
          : `inline; filename="${safeFilename}"`;
        res.writeHead(200, {
          "Content-Type": contentType,
          "Content-Disposition": disposition,
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
      // Only log actual errors, not progress lines
      if (!msg.startsWith("[download]") && !msg.startsWith("[info]") && !msg.startsWith("[youtube]")) {
        console.error("yt-dlp media stderr:", msg.substring(0, 300));
      }
    });

    proc.on("error", (err: Error) => {
      console.error("yt-dlp spawn error:", err);
      if (!res.headersSent) {
        res.status(500).send("Failed to start yt-dlp media process");
      }
    });

    proc.on("close", (code: number | null) => {
      console.log(`/api/media: yt-dlp exited with code ${code}`);
      if (!res.writableEnded) res.end();
    });

    // If client disconnects (e.g. user navigates away), kill yt-dlp
    res.on("close", () => {
      if (!proc.killed) {
        proc.kill("SIGTERM");
      }
    });
  });

  // CDN Proxy Streaming Endpoint (used for Cobalt-returned CDN URLs)
  // Range-aware: supports seek & inline preview for direct CDN links
  app.get("/api/stream", (req, res) => {
    const { url, filename, dl } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).send("Missing URL parameter");
    }

    const isDownload = dl === "1" || dl === "true";
    const safeFilename = (filename as string) || "download.mp4";

    console.log(`Piping media stream (${isDownload ? "DOWNLOAD" : "PREVIEW"}): ${url.substring(0, 60)}...`);

    const lowerUrl = url.toLowerCase();
    let referer = "https://www.youtube.com/";
    if (lowerUrl.includes("twimg") || lowerUrl.includes("twitter") || lowerUrl.includes("x.com") || lowerUrl.includes("t.co")) {
      referer = "https://twitter.com/";
    } else if (lowerUrl.includes("instagram") || lowerUrl.includes("cdninstagram") || lowerUrl.includes("fbcdn")) {
      referer = "https://www.instagram.com/";
    } else if (lowerUrl.includes("tiktok") || lowerUrl.includes("tiktokv") || lowerUrl.includes("byteoversea") || lowerUrl.includes("muscdn") || lowerUrl.includes("ibyteimg")) {
      referer = "https://www.tiktok.com/";
    }

    const clientHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": referer,
    };

    if (req.headers.range) {
      clientHeaders["range"] = req.headers.range as string;
    }

    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === "https:" ? https : http;

      const reqOpts: any = {
        headers: clientHeaders,
        rejectUnauthorized: false,
      };

      const request = protocol.get(url, reqOpts, (response) => {
        // Handle redirect if the CDN returned 301/302/307/308
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirectUrl = response.headers.location;
          console.log("Redirecting stream to:", redirectUrl);
          const dlFlag = isDownload ? "&dl=1" : "";
          res.redirect(`/api/stream?url=${encodeURIComponent(redirectUrl)}&filename=${encodeURIComponent(safeFilename)}${dlFlag}`);
          return;
        }

        let rawContentType = response.headers["content-type"];
        let contentType = "video/mp4";
        if (rawContentType && !rawContentType.includes("octet-stream") && !rawContentType.includes("text/plain")) {
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
        // Only include Content-Length and Content-Range if they are present and non-empty
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
          console.warn("Incoming stream chunk error:", err.message);
          res.end();
        });

        res.on("error", (err) => {
          console.warn("Outgoing client stream error:", err.message);
          request.destroy();
        });

        response.pipe(res);
      });

      request.on("error", (err) => {
        console.error("Proxy streaming request failure:", err.message);
        if (!res.headersSent) {
          res.status(500).send("Media streaming failed");
        }
      });

      res.on("close", () => {
        request.destroy();
      });
    } catch (e: any) {
      console.error("Invalid URL passed to stream proxy:", e.message);
      if (!res.headersSent) {
        res.status(400).send("Invalid stream URL");
      }
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
