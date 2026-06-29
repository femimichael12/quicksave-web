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
      setError("Please paste a valid Twitter (X) or Instagram link.");
      return;
    }

    const platform = getPlatform(url);
    if (platform === "unknown") {
      setError("Invalid URL. Only Twitter (X) and Instagram URLs are supported.");
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
    <div className="space-y-12 py-6" id="downloader-container">
      
      {/* Search Input Section */}
      <section className="text-center space-y-8" id="downloader-search-section">
        <div className="space-y-4 max-w-3xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl md:text-6xl font-medium font-display tracking-tight text-gray-950 dark:text-white"
            id="downloader-heading"
          >
            <span className="text-blue-500 dark:text-blue-400 font-light">Twitter</span> &{" "}
            <span className="text-pink-500 dark:text-pink-400 font-light">Instagram</span>
            <br className="sm:hidden" /> Video Downloader
          </motion.h1>
          <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto font-sans font-light leading-relaxed" id="downloader-subheading">
            Download high-quality videos, GIFs, and carousel photos from any Tweet or Instagram post. Completely free.
          </p>
        </div>

        {/* Input Form */}
        <div className="max-w-3xl mx-auto" id="downloader-form-wrapper">
          <form onSubmit={handleDownload} className="relative flex flex-col sm:flex-row gap-3 items-stretch" id="downloader-form">
            <div className="relative flex-grow flex items-center">
              <div className="absolute left-4 text-gray-400">
                <Link2 className="h-5 w-5" />
              </div>
              <input
                id="downloader-url-input"
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter a Tweet or Instagram link e.g. https://twitter.com/..."
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 shadow-md shadow-gray-100/50 dark:border-gray-800 dark:bg-gray-950 dark:text-white dark:placeholder-gray-600 dark:shadow-none transition-all"
              />
            </div>
            <button
              id="downloader-submit-btn"
              type="submit"
              disabled={isLoading}
              className="sm:px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 active:scale-98 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shrink-0"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" /> Fetching Media...
                </>
              ) : (
                <>
                  <Download className="h-5 w-5" /> Download
                </>
              )}
            </button>
          </form>

          {/* Quick Settings Drawer */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs font-semibold text-gray-500 dark:text-gray-400" id="downloader-settings">
            <span className="flex items-center gap-1">
              <Settings2 className="h-3.5 w-3.5" /> Options:
            </span>
            <div className="flex gap-2" id="downloader-quality-select">
              <button
                type="button"
                onClick={() => { setQuality("1080"); setMode("auto"); }}
                className={`px-3 py-1 rounded-full border transition-all ${
                  quality === "1080" && mode === "auto"
                    ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-400"
                    : "border-gray-100 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
                }`}
              >
                1080p Full HD
              </button>
              <button
                type="button"
                onClick={() => { setQuality("720"); setMode("auto"); }}
                className={`px-3 py-1 rounded-full border transition-all ${
                  quality === "720" && mode === "auto"
                    ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-400"
                    : "border-gray-100 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
                }`}
              >
                720p HD
              </button>
              <button
                type="button"
                onClick={() => { setQuality("480"); setMode("auto"); }}
                className={`px-3 py-1 rounded-full border transition-all ${
                  quality === "480" && mode === "auto"
                    ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-400"
                    : "border-gray-100 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
                }`}
              >
                480p SD
              </button>
              <button
                type="button"
                onClick={() => { setMode("audio"); }}
                className={`px-3 py-1 rounded-full border transition-all ${
                  mode === "audio"
                    ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-400"
                    : "border-gray-100 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
                }`}
              >
                Audio Only (MP3)
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
            className="max-w-3xl mx-auto bg-white border border-gray-100 rounded-3xl p-8 shadow-sm dark:bg-gray-950 dark:border-gray-900 flex flex-col items-center justify-center text-center"
            id="downloader-loading-card"
          >
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 mb-6">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Connecting to Media Server...</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              We are fetching and extracting direct high-speed CDNs for your requested link. This usually takes 2-4 seconds.
            </p>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-3xl mx-auto bg-red-50 border border-red-100 rounded-3xl p-6 dark:bg-red-950/10 dark:border-red-900/50 flex gap-4 items-start text-red-700 dark:text-red-400"
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
                  className="text-xs font-bold underline hover:text-red-800 dark:hover:text-red-300"
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
            <div className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 shadow-sm dark:bg-gray-950 dark:border-gray-900 space-y-6">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                
                {/* Media Preview Player (if single URL) */}
                {(result.status === "redirect" || result.status === "stream") && result.url && (
                  <div className="w-full md:w-80 shrink-0 bg-gray-900 rounded-2xl overflow-hidden aspect-video md:aspect-[9/16] relative flex items-center justify-center border border-gray-800 shadow-inner group">
                    <video
                      src={result.url}
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white uppercase backdrop-blur-sm">
                      <Play className="h-3 w-3 text-blue-400 fill-current" /> Preview
                    </div>
                  </div>
                )}

                {/* Media Detail & Action Column */}
                <div className="flex-grow space-y-6 w-full">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-400">
                      ✓ Extraction Successful
                    </div>
                    <h3 className="text-2xl font-semibold font-display tracking-tight text-gray-950 dark:text-white">
                      Your Download is Ready!
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate max-w-md">
                      Source: {url}
                    </p>
                  </div>

                  {/* If it's a redirect / single stream */}
                  {(result.status === "redirect" || result.status === "stream") && result.url && (
                    <div className="space-y-3" id="single-download-actions">
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-6 rounded-2xl shadow-md transition-all active:scale-98"
                        id="primary-download-anchor"
                      >
                        <Download className="h-5 w-5" /> Download Media File
                      </a>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(result.url || "")}
                          className="flex items-center justify-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900 font-medium py-2.5 rounded-xl text-xs transition-colors"
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
                          className="flex items-center justify-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900 font-medium py-2.5 rounded-xl text-xs transition-colors"
                        >
                          <RefreshCw className="h-4 w-4" /> Download Another
                        </button>
                      </div>
                    </div>
                  )}

                  {/* If it's a multiple media picker (Instagram Carousel / Multiple Photos) */}
                  {result.status === "picker" && result.picker && (
                    <div className="space-y-4 w-full" id="picker-download-grid">
                      <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Choose elements to download ({result.picker.length} item(s) found):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
                        {result.picker.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between border border-gray-100 rounded-xl p-3 bg-gray-50/50 hover:bg-white transition-colors dark:border-gray-900 dark:bg-gray-900/40"
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
                                <div className="h-10 w-10 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-400">
                                  {item.type === "video" ? <FileVideo className="h-5 w-5" /> : <FileImage className="h-5 w-5" />}
                                </div>
                              )}
                              <div>
                                <span className="block text-xs font-semibold text-gray-900 dark:text-white uppercase">
                                  {item.type} {index + 1}
                                </span>
                                <span className="text-[10px] text-gray-400">Direct CDN Link</span>
                              </div>
                            </div>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors dark:bg-blue-950/50 dark:text-blue-400 dark:hover:bg-blue-500 dark:hover:text-white"
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
                        className="w-full flex items-center justify-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900 font-medium py-2.5 rounded-xl text-xs transition-colors"
                      >
                        <RefreshCw className="h-4 w-4" /> Download Another Link
                      </button>
                    </div>
                  )}

                </div>
              </div>
            </div>

            {/* No AI Callout Banner anymore */}
          </motion.div>
        )}
      </AnimatePresence>

      {/* QuickSave info card explaining features */}
      <section className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 dark:bg-gray-950 dark:border-gray-900 animate-fade-in" id="downloader-features-card">
        <h2 className="text-xl font-semibold font-display tracking-tight text-gray-950 dark:text-white mb-4">
          QuickSave - Twitter & Instagram Video Downloader
        </h2>
        
        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6 font-light">
          QuickSave offers a quick, secure, and fully responsive way to download high-resolution videos and animated GIFs from Twitter (X) and Instagram. The media format you see on these social networks is starkly different from other platforms, and extracting high-speed streams often requires sophisticated proxies. With QuickSave, you get direct high-speed CDN download paths instantly.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="features-perks-grid">
          <div className="space-y-2">
            <h3 className="font-semibold font-display text-gray-950 dark:text-white text-sm">✓ Direct HD Downloads</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed font-light">
              Fetch direct, unthrottled links from Twitter (X) and Instagram CDN systems in full original HD quality.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold font-display text-gray-950 dark:text-white text-sm">✓ Carousel & Multi-Media</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed font-light">
              Supports full Instagram carousel posts, fetching multiple images and videos simultaneously in a selection grid.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold font-display text-gray-950 dark:text-white text-sm">✓ 100% Free & No Sign-up</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed font-light">
              Download as many videos as you want without creating accounts or paying premium subscription fees.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
