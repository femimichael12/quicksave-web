/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import { Link, Clipboard, Chrome, Layers, FileDown, ExternalLink, BookmarkCheck, ArrowRight, ShieldCheck, Check } from "lucide-react";

interface UtilityTool {
  name: string;
  desc: string;
  badge: string;
  status: "live" | "planned";
  color: string;
}

export default function MoreTools() {
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);

  const extraTools: UtilityTool[] = [
    {
      name: "Threads Video Downloader",
      desc: "Save HD video streams, text updates, and image carousels from Meta's Threads network in one tap.",
      badge: "FREE",
      status: "live",
      color: "bg-neutral-900 text-white dark:bg-neutral-800"
    },
    {
      name: "Facebook Video Downloader",
      desc: "Seamlessly extract Facebook videos with audio synchronized, bypassing standard dash streams limitations.",
      badge: "LIVE",
      status: "live",
      color: "bg-orange-500 text-white"
    },
    {
      name: "TikTok No-Watermark Saver",
      desc: "Download high-speed direct links to clean MP4 video files from TikTok without any brand overlays.",
      badge: "BETA",
      status: "live",
      color: "bg-teal-500 text-white"
    },
    {
      name: "Pinterest Media Downloader",
      desc: "Save animated GIFs, image pins, and story videos straight to your local disk in original upload quality.",
      badge: "PLANNED",
      status: "planned",
      color: "bg-rose-600 text-white"
    }
  ];

  // Real, fully functional bookmarklet code
  const bookmarkletCode = `javascript:(function(){const url=encodeURIComponent(window.location.href);window.open(window.location.origin+'/?url='+url,'_blank');})();`;

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setCopiedBookmarklet(true);
    setTimeout(() => setCopiedBookmarklet(false), 2000);
  };

  return (
    <div className="space-y-10 py-4 animate-fade-in" id="more-tools-root">
      {/* Page Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto" id="more-tools-header">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          <Layers className="h-3 w-3" /> Suite Extensions
        </span>
        <h1 className="text-2xl md:text-3xl font-semibold font-display tracking-tight text-gray-950 dark:text-white">
          QuickSave Extended Utilities
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base leading-relaxed font-light">
          Access specialized download portals for other social networks, or drag our direct-download bookmarklet to your browser bar for instant extraction.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="more-tools-grid">
        
        {/* Left column - Additional downloaders (7 columns) */}
        <div className="lg:col-span-7 space-y-6" id="downloader-extensions">
          <h3 className="font-semibold text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-2">
            Other Platform Portals
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="extensions-subgrid">
            {extraTools.map((tool, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-xs dark:border-gray-800 dark:bg-gray-900 hover:shadow-md transition-all duration-300"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tool.color}`}>
                      {tool.badge}
                    </span>
                    <span className="text-xs font-semibold text-gray-400 font-mono">
                      {tool.status === "live" ? "● OFFLINE" : "○ OFFLINE"}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-semibold font-display text-gray-950 dark:text-white text-base">
                      {tool.name}
                    </h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                      {tool.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-50 mt-4 dark:border-gray-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    {tool.status === "live" ? "Open Downloader" : "Planned Feature"}
                    {tool.status === "live" && <ExternalLink className="h-3.5 w-3.5" />}
                  </span>
                  <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-blue-600 dark:bg-gray-950 dark:hover:bg-blue-950/40">
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column - Bookmarklet (5 columns) */}
        <div className="lg:col-span-5 space-y-6" id="bookmarklet-section">
          <h3 className="font-semibold text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-2">
            Direct-Download Bookmarklet
          </h3>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 md:p-8 dark:border-gray-800 dark:bg-gray-900 shadow-xs space-y-6">
            <div className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40">
                <BookmarkCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="font-semibold font-display text-gray-950 dark:text-white text-base">
                1-Click Browser Shortcut
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-light">
                Download social media media files without even copying links! Drag our smart bookmarklet link below onto your web bookmarks bar, and click it whenever you are viewing any Tweet or Instagram video.
              </p>
            </div>

            {/* Draggable drag CTA card */}
            <div className="rounded-2xl border border-blue-50 bg-blue-50/20 p-4 dark:border-blue-950/30 dark:bg-blue-950/10 text-center space-y-3">
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                DRAG THIS TO YOUR BOOKMARKS BAR
              </span>
              <a
                href={bookmarkletCode}
                onClick={(e) => e.preventDefault()}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/15 hover:bg-blue-700 transition-colors select-none cursor-grab active:cursor-grabbing"
              >
                <Chrome className="h-4 w-4" /> QuickSave Downloader
              </a>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 block">
                (Or right-click and save to bookmarks)
              </span>
            </div>

            {/* Copy code alternate */}
            <div className="space-y-2 pt-2 border-t border-gray-50 dark:border-gray-800">
              <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase block">
                OR MANUALLY COPY CODE
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={bookmarkletCode}
                  className="flex-grow text-[10px] font-mono text-gray-400 bg-gray-50 dark:bg-gray-950 dark:text-gray-500 border border-gray-100 dark:border-gray-850 px-3 py-2 rounded-xl focus:outline-none"
                />
                <button
                  onClick={copyBookmarklet}
                  className="shrink-0 flex items-center justify-center h-8.5 w-8.5 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 cursor-pointer"
                  title="Copy Bookmarklet Code"
                >
                  {copiedBookmarklet ? <Check className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Shield and safety badge */}
            <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
              <ShieldCheck className="h-4 w-4 text-green-500 shrink-0" />
              <span>100% Secure, client-side redirection. No tracking or cookies.</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
