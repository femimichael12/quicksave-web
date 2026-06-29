/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Check, Download, Image as ImageIcon, MessageCircle, Heart, Repeat, Bookmark, Eye, Sparkles,  Camera } from "lucide-react";


export default function ScreenshotGenerator() {
  const [displayName, setDisplayName] = useState("QuickSave User");
  const [username, setUsername] = useState("quicksave_app");
  const [verified, setVerified] = useState(true);
  const [verifiedType, setVerifiedType] = useState<"blue" | "gold">("blue");
  const [text, setText] = useState("QuickSave is honestly the cleanest video downloader I have ever used. Direct high-speed links, zero spam, and range-aware proxy streaming! 💎🔥 #quicksave #creator");
  const [dateStr, setDateStr] = useState("12:45 PM · Jun 24, 2026");
  const [likes, setLikes] = useState("12.4K");
  const [retweets, setRetweets] = useState("3.2K");
  const [bookmarks, setBookmarks] = useState("892");
  const [views, setViews] = useState("142.5K");
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const avatars = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80",
    "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80"
  ];

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && typeof event.target.result === "string") {
          setCustomAvatar(event.target.result);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const drawAndDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Define dimensions (Retina scale 2x)
    const scale = 2;
    const width = 600;
    const height = 340;
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    // Apply font loading fallbacks
    ctx.textBaseline = "top";

    // Set background theme colors
    const bg = isDarkTheme ? "#0f172a" : "#ffffff";
    const textMain = isDarkTheme ? "#f8fafc" : "#0f172a";
    const textSub = isDarkTheme ? "#94a3b8" : "#64748b";
    const borderCol = isDarkTheme ? "#1e293b" : "#f1f5f9";

    const drawRest = (avatarImg: HTMLImageElement | null) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Draw card border
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 1;
      ctx.strokeRect(10, 10, width - 20, height - 20);

      // Draw Avatar (Circular clipping)
      ctx.save();
      ctx.beginPath();
      ctx.arc(45, 45, 20, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      if (avatarImg) {
        ctx.drawImage(avatarImg, 25, 25, 40, 40);
      } else {
        // Draw a placeholder blue avatar circle with the first letter of displayName
        ctx.fillStyle = "#3b82f6";
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 18px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(displayName.charAt(0).toUpperCase(), 45, 45);
      }
      ctx.restore();

      // Display Name & Username text
      ctx.fillStyle = textMain;
      ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(displayName, 75, 27);

      // Measure text for verified badge placement
      const nameWidth = ctx.measureText(displayName).width;

      // Draw verified badge
      if (verified) {
        ctx.save();
        const badgeX = 75 + nameWidth + 5;
        const badgeY = 28;
        ctx.translate(badgeX, badgeY);
        const badgeSize = 15;
        const scaleFactor = badgeSize / 22;
        ctx.scale(scaleFactor, scaleFactor);
        
        // Exact official Twitter/X verified badge rosette path (22x22 viewbox)
        const p = new Path2D("M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z");
        
        ctx.fillStyle = verifiedType === "blue" ? "#1d9bf0" : "#e7b510";
        ctx.fill(p);
        ctx.restore();
      }

      ctx.fillStyle = textSub;
      ctx.font = "13px system-ui, -apple-system, sans-serif";
      ctx.fillText(`@${username}`, 75, 46);

      // Draw Main Tweet Text (word wrapped)
      ctx.fillStyle = textMain;
      ctx.font = "14px system-ui, -apple-system, sans-serif";
      
      const words = text.split(" ");
      let line = "";
      let y = 85;
      const maxWidth = width - 60;
      const lineHeight = 20;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line, 30, y);
          line = words[n] + " ";
          y += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, 30, y);

      // Draw Date String
      ctx.fillStyle = textSub;
      ctx.font = "12px system-ui, -apple-system, sans-serif";
      ctx.fillText(dateStr, 30, y + 25);

      // Draw Stats row line divider
      ctx.strokeStyle = borderCol;
      ctx.beginPath();
      ctx.moveTo(30, y + 48);
      ctx.lineTo(width - 30, y + 48);
      ctx.stroke();

      // Stats row text elements
      ctx.fillStyle = textMain;
      ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
      
      let statX = 30;
      const stats = [
        { label: "Retweets", val: retweets },
        { label: "Quotes", val: "24" },
        { label: "Likes", val: likes },
        { label: "Bookmarks", val: bookmarks }
      ];

      stats.forEach((s) => {
        ctx.fillStyle = textMain;
        ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
        ctx.fillText(s.val, statX, y + 58);
        const valW = ctx.measureText(s.val).width;
        
        ctx.fillStyle = textSub;
        ctx.font = "13px system-ui, -apple-system, sans-serif";
        ctx.fillText(` ${s.label}`, statX + valW, y + 58);
        const lblW = ctx.measureText(` ${s.label}`).width;
        
        statX += valW + lblW + 15;
      });

      // Bottom border for icons
      ctx.strokeStyle = borderCol;
      ctx.beginPath();
      ctx.moveTo(30, y + 80);
      ctx.lineTo(width - 30, y + 80);
      ctx.stroke();

      // Export file download link trigger
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `mock_post_screenshot.png`;
      link.href = dataUrl;
      link.click();
    };

    const avatarUrl = customAvatar || avatars[avatarIndex];
    const avatarImg = new Image();
    avatarImg.crossOrigin = "anonymous";
    avatarImg.onload = () => {
      drawRest(avatarImg);
    };
    avatarImg.onerror = () => {
      drawRest(null);
    };
    avatarImg.src = avatarUrl;
  };

  return (
    <div className="space-y-10 py-4 animate-fade-in" id="screenshot-view-root">
      {/* Page Heading */}
      <div className="text-center space-y-3 max-w-2xl mx-auto" id="screenshot-header">
       <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
  <Camera className="h-3 w-3" /> Screenshot Studio
</span>
        <h1 className="text-2xl md:text-3xl font-semibold font-display tracking-tight text-gray-950 dark:text-white">
          Social Post Screenshot Generator
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base leading-relaxed font-light">
          Create pixel-perfect, beautifully structured mock posts and download them as high-quality images. Great for marketing, mockup design, and social media planning.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="screenshot-generator-grid">
        {/* Controls Column (left 5 columns) */}
        <div className="lg:col-span-5 space-y-6" id="generator-controls">
          <div className="bg-white rounded-3xl border border-gray-100 p-6 space-y-4 dark:bg-gray-900 dark:border-gray-800 shadow-xs">
            <h3 className="font-semibold font-display text-gray-950 dark:text-white text-sm border-b border-gray-50 pb-2.5 dark:border-gray-800">
              Customize Content
            </h3>
            
            {/* Display & User Handle */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 dark:text-gray-500">DISPLAY NAME</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full text-xs rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 dark:text-gray-500">USERNAME HANDLE</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-semibold text-gray-400 dark:text-gray-500">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full text-xs rounded-xl border border-gray-100 bg-gray-50/50 pl-6 pr-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Verified options */}
            <div className="flex items-center justify-between border-t border-gray-50 pt-3 dark:border-gray-800">
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Verified Badge</span>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={verified}
                  onChange={(e) => setVerified(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {verified && (
                  <select
                    value={verifiedType}
                    onChange={(e) => setVerifiedType(e.target.value as any)}
                    className="text-xs rounded-lg border border-gray-100 bg-gray-50 py-1 px-2 text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                  >
                    <option value="blue">Blue Badge</option>
                    <option value="gold">Gold Badge</option>
                  </select>
                )}
              </div>
            </div>

            {/* Post Content */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 dark:text-gray-500">POST TEXT CONTENT</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                className="w-full text-xs rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white leading-relaxed resize-none"
              />
            </div>

            {/* Date and stats */}
            <div className="grid grid-cols-2 gap-4 border-t border-gray-50 pt-3 dark:border-gray-800">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 dark:text-gray-500">DATE STRING</label>
                <input
                  type="text"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full text-xs rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 dark:text-gray-500">LIKES COUNT</label>
                <input
                  type="text"
                  value={likes}
                  onChange={(e) => setLikes(e.target.value)}
                  className="w-full text-xs rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                />
              </div>
            </div>

            {/* Avatar Selector */}
            <div className="space-y-2 border-t border-gray-50 pt-3 dark:border-gray-800">
              <label className="text-xs font-semibold text-gray-400 dark:text-gray-500">SELECT AVATAR</label>
              <div className="flex items-center gap-3">
                {avatars.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setAvatarIndex(idx);
                      setCustomAvatar(null);
                    }}
                    className={`relative h-10 w-10 overflow-hidden rounded-full border-2 transition-all cursor-pointer ${
                      avatarIndex === idx && !customAvatar ? "border-blue-500 scale-105" : "border-transparent"
                    }`}
                  >
                    <img src={url} alt="Avatar" className="h-full w-full object-cover" />
                  </button>
                ))}
                
                {/* Custom upload button */}
                <label className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-gray-200 hover:border-blue-500 cursor-pointer dark:border-gray-700 transition-colors">
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  {customAvatar ? (
                    <img src={customAvatar} alt="Custom" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-gray-400 hover:text-blue-500" />
                  )}
                </label>
              </div>
            </div>

            {/* Toggle Preview Theme */}
            <div className="flex items-center justify-between border-t border-gray-50 pt-3 dark:border-gray-800">
              <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Dark Mode Post Preview</span>
              <button
                onClick={() => setIsDarkTheme(!isDarkTheme)}
                className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors focus:outline-none ${
                  isDarkTheme ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <div
                  className={`h-5 w-5 rounded-full bg-white shadow-md transform transition-transform ${
                    isDarkTheme ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Live Preview Column (right 7 columns) */}
        <div className="lg:col-span-7 flex flex-col justify-between" id="generator-preview">
          <div className="space-y-6">
            <h3 className="font-bold text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest pl-2">
              Live Preview
            </h3>

            {/* The Real Interactive Post Element */}
            <div
              className={`rounded-3xl border p-6 md:p-8 transition-colors duration-300 select-none shadow-md ${
                isDarkTheme
                  ? "bg-slate-900 border-slate-800 text-slate-100"
                  : "bg-white border-gray-100 text-slate-900"
              }`}
              id="live-post-element"
            >
              {/* Header profile row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={customAvatar || avatars[avatarIndex]}
                    alt="Author"
                    className="h-11 w-11 rounded-full object-cover border border-gray-50 dark:border-slate-800"
                  />
                  <div className="leading-tight">
                    <h4 className="font-bold text-sm md:text-base flex items-center gap-1">
                      {displayName}
                      {verified && (
                        <svg
                          viewBox="0 0 22 22"
                          className="h-4.5 w-4.5 shrink-0 select-none align-middle"
                          fill="none"
                          id="verified-badge-svg"
                        >
                          <path
                            d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"
                            fill={verifiedType === "blue" ? "#1d9bf0" : "#e7b510"}
                          />
                        </svg>
                      )}
                    </h4>
                    <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">@{username}</p>
                  </div>
                </div>
              </div>

              {/* Text content */}
              <p className="mt-4 text-sm md:text-base leading-relaxed break-words font-sans">
                {text}
              </p>

              {/* Post date */}
              <p className="mt-4 text-xs font-medium text-gray-400 dark:text-slate-500 font-mono">
                {dateStr}
              </p>

              {/* Line Divider */}
              <hr className="my-4 border-gray-100 dark:border-slate-800/80" />

              {/* Stats counts row */}
              <div className="flex items-center gap-4 text-xs md:text-sm font-semibold text-gray-400 dark:text-slate-500 font-mono">
                <p>
                  <span className={isDarkTheme ? "text-slate-100" : "text-slate-900"}>{retweets}</span> Retweets
                </p>
                <p>
                  <span className={isDarkTheme ? "text-slate-100" : "text-slate-900"}>{likes}</span> Likes
                </p>
                <p>
                  <span className={isDarkTheme ? "text-slate-100" : "text-slate-900"}>{bookmarks}</span> Bookmarks
                </p>
              </div>

              {/* Line Divider */}
              <hr className="my-4 border-gray-100 dark:border-slate-800/80" />

              {/* Interaction icons bar */}
              <div className="flex justify-between px-2 text-gray-400 dark:text-slate-500">
                <MessageCircle className="h-4.5 w-4.5 hover:text-blue-500 cursor-pointer transition-colors" />
                <Repeat className="h-4.5 w-4.5 hover:text-green-500 cursor-pointer transition-colors" />
                <Heart className="h-4.5 w-4.5 hover:text-pink-500 cursor-pointer transition-colors" />
                <Bookmark className="h-4.5 w-4.5 hover:text-blue-500 cursor-pointer transition-colors" />
                <Eye className="h-4.5 w-4.5 hover:text-blue-500 cursor-pointer transition-colors" />
              </div>
            </div>
          </div>

          {/* Download CTA block */}
          <div className="pt-6">
            <button
              onClick={drawAndDownload}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 transition-all shadow-md shadow-blue-500/10 cursor-pointer active:scale-[0.98]"
              id="download-screenshot-btn"
            >
              <Download className="h-5 w-5" /> Download Screenshot Image (.png)
            </button>
            <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 mt-2 font-mono">
              Rendered local browser-side via custom 2X Retina Canvas scaler.
            </p>
          </div>
        </div>
      </div>

      {/* Hidden Canvas used for drawing engine */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
