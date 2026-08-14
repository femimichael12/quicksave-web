/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link2, Sparkles, Download, RefreshCw, AlertCircle, FileVideo, FileImage, Clipboard, Check, Play, Settings2 } from "lucide-react";
import { DownloadResult, Platform } from "../types";

export default function Downloader() {
  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState("1080");
  const [mode, setMode] = useState("auto"); // auto, audio
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DownloadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Detect platform based on URL
  const getPlatform = (inputUrl: string): Platform => {
    if (/twitter\.com|x\.com/.test(inputUrl)) return "twitter";
    if (/instagram\.com/.test(inputUrl)) return "instagram";
    if (/youtube\.com|youtu\.be/.test(inputUrl)) return "youtube";
    if (/tiktok\.com/.test(inputUrl)) return "tiktok";
    return "unknown";
  };

  const handleCopyLink = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      setError("Please paste a valid Twitter (X), Instagram, YouTube, or TikTok link.");
      return;
    }

    const platform = getPlatform(url);
    if (platform === "unknown") {
      setError("Invalid URL. Twitter (X), Instagram, YouTube, and TikTok URLs are supported.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          videoQuality: quality,
          downloadMode: mode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to download media.");
      }

      if (data.status === "error") {
        throw new Error(data.text || (typeof data.error === 'string' ? data.error : data.error?.code || "Media stream extraction failed."));
      }

      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong extracting media streams. Please check your link and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const clearForm = () => {
    setUrl("");
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6 sm:space-y-12 py-1 sm:py-6" id="downloader-container">
      
      {/* Search Input Section */}
      <section className="text-center space-y-4 sm:space-y-8" id="downloader-search-section">
        <div className="space-y-2 sm:space-y-4 max-w-3xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl sm:text-5xl md:text-6xl font-medium font-display tracking-tight text-gray-950 leading-tight sm:leading-none"
            id="downloader-heading"
          >
            <span className="text-blue-500 font-light">Twitter</span>,{" "}
            <span className="text-pink-500 font-light">Instagram</span>,{" "}
            <span className="text-red-500 font-light">YouTube</span> &{" "}
            <span className="text-teal-500 font-light">TikTok</span>
            <br className="hidden sm:inline" /> Video Downloader
          </motion.h1>
          <p className="text-xs sm:text-base md:text-lg text-gray-500 max-w-2xl mx-auto font-sans font-light leading-tight sm:leading-relaxed" id="downloader-subheading">
            <span className="sm:hidden">Download videos quickly and easily.</span>
            <span className="hidden sm:inline">Download high-quality videos, Shorts, Reels, GIFs, and audio tracks from Twitter (X), Instagram, YouTube, and TikTok. Completely free.</span>
          </p>

          {/* Supported Platforms Badges */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 pt-1 sm:pt-2" id="supported-platforms-badges">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span> Twitter / X
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-medium bg-pink-50 text-pink-600 border border-pink-100">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse"></span> Instagram
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-medium bg-red-50 text-red-600 border border-red-100">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> YouTube
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-medium bg-teal-50 text-teal-600 border border-teal-100">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span> TikTok
            </span>
          </div>
        </div>

        {/* Input Form */}
        <div className="max-w-3xl mx-auto" id="downloader-form-wrapper">
          <form onSubmit={handleDownload} className="relative flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch" id="downloader-form">
            <div className="relative flex-grow flex items-center">
              <div className="absolute left-3.5 sm:left-4 text-gray-400">
                <Link2 className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
              </div>
              <input
                id="downloader-url-input"
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste link e.g. https://youtube.com/watch?v=... or tiktok.com/..."
                className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-4 text-sm sm:text-base rounded-2xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 shadow-sm sm:shadow-md shadow-gray-100/50 transition-all"
              />
            </div>
            <button
              id="downloader-submit-btn"
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto sm:px-8 py-3.5 sm:py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shrink-0 cursor-pointer text-sm sm:text-base"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4.5 w-4.5 sm:h-5 sm:w-5 animate-spin" /> Fetching Media...
                </>
              ) : (
                <>
                  <Download className="h-4.5 w-4.5 sm:h-5 sm:w-5" /> Download
                </>
              )}
            </button>
          </form>

          {/* Quick Settings Drawer */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mt-3 sm:mt-6 text-[11px] sm:text-xs font-semibold text-gray-500" id="downloader-settings">
            <span className="flex items-center gap-1">
              <Settings2 className="h-3.5 w-3.5" /> Options:
            </span>
            <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2" id="downloader-quality-select">
              <button
                type="button"
                onClick={() => { setQuality("1080"); setMode("auto"); }}
                className={`px-2.5 py-1 sm:px-3 sm:py-1 rounded-full border transition-all cursor-pointer ${
                  quality === "1080" && mode === "auto"
                    ? "bg-blue-50 border-blue-200 text-blue-600"
                    : "border-gray-100 hover:border-gray-300"
                }`}
              >
                1080p HD
              </button>
              <button
                type="button"
                onClick={() => { setQuality("720"); setMode("auto"); }}
                className={`px-2.5 py-1 sm:px-3 sm:py-1 rounded-full border transition-all cursor-pointer ${
                  quality === "720" && mode === "auto"
                    ? "bg-blue-50 border-blue-200 text-blue-600"
                    : "border-gray-100 hover:border-gray-300"
                }`}
              >
                720p HD
              </button>
              <button
                type="button"
                onClick={() => { setQuality("480"); setMode("auto"); }}
                className={`px-2.5 py-1 sm:px-3 sm:py-1 rounded-full border transition-all cursor-pointer ${
                  quality === "480" && mode === "auto"
                    ? "bg-blue-50 border-blue-200 text-blue-600"
                    : "border-gray-100 hover:border-gray-300"
                }`}
              >
                480p SD
              </button>
              <button
                type="button"
                onClick={() => { setMode("audio"); }}
                className={`px-2.5 py-1 sm:px-3 sm:py-1 rounded-full border transition-all cursor-pointer ${
                  mode === "audio"
                    ? "bg-blue-50 border-blue-200 text-blue-600"
                    : "border-gray-100 hover:border-gray-300"
                }`}
              >
                Audio (MP3)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Loading/Error/Results Display */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-3xl mx-auto bg-white border border-gray-100 rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center text-center"
            id="downloader-loading-card"
          >
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-6">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Connecting to High-Speed Media Server...</h3>
            <p className="mt-2 text-sm text-gray-500 max-w-sm">
              We are fetching direct high-speed CDN streams for your link.
            </p>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-3xl mx-auto bg-red-50 border border-red-100 rounded-3xl p-6 flex gap-4 items-start text-red-700"
            id="downloader-error-card"
          >
            <AlertCircle className="h-6 w-6 shrink-0" />
            <div className="space-y-1 flex-grow">
              <h4 className="font-bold text-base">Media Stream Extraction Error</h4>
              <p className="text-sm leading-relaxed">{error}</p>
              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={clearForm}
                  className="text-xs font-bold underline hover:text-red-800"
                >
                  Clear Link
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="max-w-3xl mx-auto space-y-6"
            id="downloader-results-card"
          >
            {/* Main Result Body */}
            <div className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 overflow-hidden">
             <div className="flex flex-col lg:flex-row gap-6 items-start">
                
                {/* Media Preview Player (if single URL) */}
                {(result.status === "redirect" || result.status === "stream") && result.url && (
                 <div className="w-full lg:w-80 shrink-0 bg-gray-900 rounded-2xl overflow-hidden aspect-video md:aspect-[9/16] relative flex items-center justify-center border border-gray-800 shadow-inner group">
                    {mode === "audio" ? (
                      <div className="w-full p-6 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 mx-auto flex items-center justify-center">
                          <Play className="h-8 w-8 fill-current ml-1" />
                        </div>
                        <span className="text-xs font-semibold text-gray-300 block">Audio Preview (MP3)</span>
                        <audio src={result.url} controls className="w-full" />
                      </div>
                    ) : (
                      <>
                        <video
                          src={result.url}
                          poster={result.thumb}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-contain cursor-pointer"
                        />
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white uppercase backdrop-blur-sm pointer-events-none">
                          <Play className="h-3 w-3 text-blue-400 fill-current" /> Preview
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Media Detail & Action Column */}
                <div className="flex-1 min-w-0 space-y-6 w-full overflow-hidden">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                      ✓ Extraction Successful
                    </div>
                    <h3 className="text-2xl font-semibold font-display tracking-tight text-gray-950 truncate">
                      {result.title ? result.title : "Your Download is Ready!"}
                    </h3>
                    <p className="text-xs text-gray-400 font-mono break-all">
                      Source: {url}
                    </p>
                  </div>

                  {/* If it's a redirect / single stream */}
                  {(result.status === "redirect" || result.status === "stream") && result.url && (
                    <div className="space-y-3" id="single-download-actions">
                      <a
                        href={`${result.url}&dl=1`}
                        download={result.filename || "download.mp4"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full max-w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-4 rounded-2xl shadow-md transition-all active:scale-98 cursor-pointer"
                        id="primary-download-anchor"
                      >
                        <Download className="h-5 w-5" /> Download Media File
                      </a>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(`${window.location.origin}${result.url}&dl=1`)}
                          className="flex items-center justify-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          {copiedLink ? (
                            <>
                              <Check className="h-4 w-4 text-green-500" /> Copied!
                            </>
                          ) : (
                            <>
                              <Clipboard className="h-4 w-4" /> Copy Direct Link
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={clearForm}
                          className="flex items-center justify-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                        >
                          <RefreshCw className="h-4 w-4" /> Download Another
                        </button>
                      </div>
                    </div>
                  )}

                  {/* If it's a multiple media picker (Instagram Carousel / Multiple Photos) */}
                  {result.status === "picker" && result.picker && (
                    <div className="space-y-4 w-full" id="picker-download-grid">
                      <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Choose elements to download ({result.picker.length} item(s) found):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
                        {result.picker.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between border border-gray-100 rounded-xl p-3 bg-gray-50/50 hover:bg-white transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {item.thumb ? (
                                <img
                                  src={item.thumb}
                                  alt="Media preview"
                                  className="h-10 w-10 object-cover rounded-lg"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="h-10 w-10 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400">
                                  {item.type === "video" ? <FileVideo className="h-5 w-5" /> : <FileImage className="h-5 w-5" />}
                                </div>
                              )}
                              <div>
                                <span className="block text-xs font-semibold text-gray-900 uppercase">
                                  {item.type} {index + 1}
                                </span>
                                <span className="text-[10px] text-gray-400">Direct CDN Link</span>
                              </div>
                            </div>
                            <a
                              href={`${item.url}&dl=1`}
                              download={`media_${index + 1}.${item.type === "video" ? "mp4" : "jpg"}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="Download Item"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={clearForm}
                        className="w-full flex items-center justify-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        <RefreshCw className="h-4 w-4" /> Download Another Link
                      </button>
                    </div>
                  )}

                </div>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* QuickSave info card explaining features */}
      <section className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 animate-fade-in" id="downloader-features-card">
        <h2 className="text-xl font-semibold font-display tracking-tight text-gray-950 mb-4">
          QuickSave - Social Video & Audio Downloader
        </h2>
        
        <p className="text-gray-500 text-sm leading-relaxed mb-6 font-light">
          QuickSave offers a fast, secure, and fully responsive way to download high-resolution videos, Shorts, Reels, and audio tracks from Twitter (X), Instagram, YouTube, and TikTok. Extract high-speed streams instantly in original upload quality without watermarks or software installation.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="features-perks-grid">
          <div className="space-y-2">
            <h3 className="font-semibold font-display text-gray-950 text-sm">✓ Direct HD Downloads</h3>
            <p className="text-xs text-gray-400 leading-relaxed font-light">
              Fetch direct, unthrottled links from Twitter, Instagram, YouTube, and TikTok CDN systems in up to 1080p/4K HD quality.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold font-display text-gray-950 text-sm">✓ Shorts, Reels & TikTok</h3>
            <p className="text-xs text-gray-400 leading-relaxed font-light">
              Full support for short-form video content including YouTube Shorts, Instagram Reels, and clean no-watermark TikTok clips.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold font-display text-gray-950 text-sm">✓ 100% Free & Unlimited</h3>
            <p className="text-xs text-gray-400 leading-relaxed font-light">
              Download as many videos as you want without creating accounts or paying subscription fees. Fast & clean.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}

