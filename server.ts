import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Bypass strict SSL verification for restrictive networks (fixes UNABLE_TO_VERIFY_LEAF_SIGNATURE)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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

// Query media info with yt-dlp
function getMediaInfo(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!isYtDlpAvailable) {
      reject(new Error("yt-dlp binary is currently not available."));
      return;
    }
    
    const args = ["-j", "--no-playlist", "--no-warnings", url];
    console.log(`Running: ${ytDlpPath} ${args.join(" ")}`);
    const proc = spawn(ytDlpPath, args);
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
        console.error("yt-dlp info error stderr:", stderr);
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

  // API Route: Download Twitter/Instagram Videos
  app.post("/api/download", async (req, res) => {
    const { url, videoQuality, downloadMode, audioFormat } = req.body;
    try {
      if (!url) {
        return res.status(400).json({ error: "Missing required field: url" });
      }

      // Basic validation for URL
      const isTwitter = /twitter\.com|x\.com/.test(url);
      const isInstagram = /instagram\.com/.test(url);

      if (!isTwitter && !isInstagram) {
        return res.status(400).json({
          error: "Invalid URL. Only Twitter (X) and Instagram URLs are supported.",
        });
      }

      console.log(`Processing download request for: ${url} (Mode: ${downloadMode || "auto"}, Quality: ${videoQuality || "1080"})`);

      // Strategy A: Try using yt-dlp first
      if (isYtDlpAvailable) {
        try {
          const info = await getMediaInfo(url);
          
          if (info) {
            const cleanTitle = (info.title || "video").replace(/[^a-zA-Z0-9_.-]/g, "_").substring(0, 50);
            
            // Check if it's a playlist (e.g., carousel)
            if (info._type === "playlist" || (info.entries && info.entries.length > 0)) {
              const entries = info.entries || [];
              const picker = entries.map((entry: any, index: number) => {
                let entryUrl = entry.url;
                let entryExt = entry.ext || "mp4";
                
                // Select best video format for the entry if formats are available
                if (entry.formats && entry.formats.length > 0) {
                  const targetHeight = parseInt(videoQuality) || 1080;
                  const validFormats = entry.formats.filter((f: any) => f.url && f.vcodec !== "none" && (f.height || 0) <= targetHeight);
                  if (validFormats.length > 0) {
                    validFormats.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
                    entryUrl = validFormats[0].url;
                    entryExt = validFormats[0].ext || "mp4";
                  }
                }
                
                const safeFilename = `${cleanTitle}_part${index + 1}.${entryExt}`;
                return {
                  url: `/api/stream?url=${encodeURIComponent(entryUrl || "")}&filename=${encodeURIComponent(safeFilename)}`,
                  type: entry.vcodec === "none" ? "audio" : "video",
                  thumb: entry.thumbnail || entry.thumbnails?.[0]?.url || info.thumbnail || ""
                };
              });

              return res.json({
                status: "picker",
                picker
              });
            }

            // Single video selection format sorting logic
            let chosenUrl = info.url;
            let chosenExt = info.ext || "mp4";

            if (info.formats && info.formats.length > 0) {
              if (downloadMode === "audio") {
                const audioFormats = info.formats.filter((f: any) => f.vcodec === "none" && f.url);
                if (audioFormats.length > 0) {
                  audioFormats.sort((a: any, b: any) => (b.abr || 0) - (a.abr || 0));
                  chosenUrl = audioFormats[0].url;
                  chosenExt = audioFormats[0].ext || "mp3";
                }
              } else {
                const targetHeight = parseInt(videoQuality) || 1080;
                // Look for formats that have both video and audio
                const videoFormats = info.formats.filter((f: any) => 
                  f.url && 
                  f.vcodec !== "none" && 
                  f.acodec !== "none" &&
                  (f.height || 0) <= targetHeight
                );
                
                if (videoFormats.length > 0) {
                  videoFormats.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
                  chosenUrl = videoFormats[0].url;
                  chosenExt = videoFormats[0].ext || "mp4";
                } else {
                  // Fallback to any video format with video URLs
                  const anyVideo = info.formats.filter((f: any) => f.url && f.vcodec !== "none");
                  if (anyVideo.length > 0) {
                    anyVideo.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
                    chosenUrl = anyVideo[0].url;
                    chosenExt = anyVideo[0].ext || "mp4";
                  }
                }
              }
            }

            if (chosenUrl) {
              const safeFilename = `${cleanTitle}.${downloadMode === "audio" ? "mp3" : chosenExt}`;
              console.log(`yt-dlp successfully resolved. Direct cdn url: ${chosenUrl.substring(0, 60)}...`);
              return res.json({
                status: "stream",
                url: `/api/stream?url=${encodeURIComponent(chosenUrl)}&filename=${encodeURIComponent(safeFilename)}`
              });
            }
          }
        } catch (ytDlpError: any) {
          console.warn("yt-dlp primary extraction failed, trying Cobalt API fallback...", ytDlpError.message);
        }
      }

      // Strategy B: Cobalt API Fallback
      console.log("Triggering Cobalt API fallback process...");
      const endpoints = [
        "https://api.cobalt.tools/api/json",
        "https://api.cobalt.tools/",
        "https://co.wukko.me/api/json",
        "https://co.wukko.me/",
        "https://cobalt.api.red.velvet.cafe/api/json",
        "https://cobalt.api.red.velvet.cafe/",
        "https://cobalt-api.kwi.mobi/",
        "https://co.bune.city/",
        "https://co.e9.ms/",
        "https://cobalt.dark-underground.xyz/",
        "https://cobalt.rotur.dev/",
        "https://co.vxtwitter.com/",
        "https://cobalt.rip/"
      ];

      const payloads = [];
      const modernPayload: any = { url, filenamePattern: "pretty" };
      if (downloadMode === "audio") {
        modernPayload.downloadMode = "audio";
        modernPayload.audioFormat = audioFormat || "mp3";
      } else {
        modernPayload.downloadMode = "video";
        modernPayload.videoQuality = videoQuality || "1080";
      }
      payloads.push(modernPayload);

      const legacyPayload: any = { url, filenamePattern: "pretty" };
      if (downloadMode === "audio") {
        legacyPayload.audioOnly = true;
        legacyPayload.audioFormat = audioFormat || "mp3";
      } else {
        legacyPayload.audioOnly = false;
        legacyPayload.videoQuality = videoQuality || "1080";
      }
      payloads.push(legacyPayload);
      payloads.push({ url });

      let successData = null;
      let lastError = null;

      endpointLoop: for (const endpoint of endpoints) {
        for (const payload of payloads) {
          try {
            console.log(`Trying Cobalt endpoint: ${endpoint}`);
            const { status, ok, data, errText } = await new Promise<any>((resolve) => {
              const parsedUrl = new URL(endpoint);
              const req = https.request(parsedUrl, {
                method: "POST",
                headers: {
                  "Accept": "application/json",
                  "Content-Type": "application/json",
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                },
                rejectUnauthorized: false
              }, (res) => {
                let body = "";
                res.on("data", chunk => body += chunk);
                res.on("end", () => {
                  if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                      resolve({ status: res.statusCode, ok: true, data: JSON.parse(body) });
                    } catch (e) {
                      resolve({ status: res.statusCode, ok: false, errText: "Parse error" });
                    }
                  } else {
                    resolve({ status: res.statusCode, ok: false, errText: body });
                  }
                });
              });
              req.on("error", (e) => resolve({ ok: false, errText: e.message }));
              req.write(JSON.stringify(payload));
              req.end();
            });

            if (ok) {
              if (data) {
                if (data.status === "error") {
                  lastError = new Error(data.text || "Media extraction failed.");
                } else if (data.status || data.url || data.picker) {
                  successData = data;
                  break endpointLoop;
                }
              }
            } else {
              lastError = new Error(`Server returned status ${status}: ${errText || "Bad Request"}`);
            }
          } catch (err: any) {
            lastError = err;
          }
        }
      }

      if (!successData) {
        throw new Error(lastError ? lastError.message : "All downloader endpoints are currently busy. Please try again in a few seconds.");
      }

      // If Cobalt returned a direct url, we proxy stream it to bypass CORS/Referer blocks
      if (successData.url) {
        const cleanTitle = "video";
        const safeFilename = `${cleanTitle}.${downloadMode === "audio" ? "mp3" : "mp4"}`;
        return res.json({
          status: "stream",
          url: `/api/stream?url=${encodeURIComponent(successData.url)}&filename=${encodeURIComponent(safeFilename)}`
        });
      }

      // If Cobalt returned a list of items (picker)
      if (successData.picker) {
        const mappedPicker = successData.picker.map((item: any, idx: number) => {
          const safeFilename = `media_${idx + 1}.${item.type === "video" ? "mp4" : "jpg"}`;
          return {
            ...item,
            url: `/api/stream?url=${encodeURIComponent(item.url)}&filename=${encodeURIComponent(safeFilename)}`
          };
        });
        return res.json({
          status: "picker",
          picker: mappedPicker
        });
      }

      return res.json(successData);
    } catch (error: any) {
      console.error("Download route error:", error);
      return res.status(500).json({
        error: error.message || "An error occurred while communicating with downloader services.",
      });
    }
  });

  // Range-aware Streaming Proxy Endpoint (bypasses CORS & hotlink blocks, supports fast native seek)
  app.get("/api/stream", (req, res) => {
    const { url, filename } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).send("Missing URL parameter");
    }

    console.log(`Piping media stream: ${url.substring(0, 60)}...`);

    const clientHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://twitter.com/" // Bypasses some referrer validation checks
    };

    if (req.headers.range) {
      clientHeaders["range"] = req.headers.range;
    }

    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === "https:" ? https : http;

      const request = protocol.get(url, { headers: clientHeaders }, (response) => {
        // Handle redirect if the CDN returned 301/302/307/308
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          const redirectUrl = response.headers.location;
          console.log("Redirecting stream to:", redirectUrl);
          // Redirect the client or stream from the new location
          res.redirect(`/api/stream?url=${encodeURIComponent(redirectUrl)}&filename=${encodeURIComponent(filename as string || "download.mp4")}`);
          return;
        }

        // Forward matching status & headers for video seekability
        res.writeHead(response.statusCode || 200, {
          "Content-Disposition": `attachment; filename="${filename || "download.mp4"}"`,
          "Content-Type": response.headers["content-type"] || "video/mp4",
          "Content-Length": response.headers["content-length"] || "",
          "Content-Range": response.headers["content-range"] || "",
          "Accept-Ranges": response.headers["accept-ranges"] || "bytes",
          "Cache-Control": "public, max-age=3600"
        });

        response.pipe(res);
      });

      request.on("error", (err) => {
        console.error("Proxy streaming request failure:", err);
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

      // Call Gemini 3.5 Flash
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
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
