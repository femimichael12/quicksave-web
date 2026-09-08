import app, { initYtDlp } from "../server.ts";

// Warm up binary discovery on serverless cold start
initYtDlp().catch((err: any) => {
  console.warn("[Vercel Warmup] yt-dlp initialization notice:", err?.message || err);
});

export default app;
