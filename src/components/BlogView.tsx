/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Calendar, User, Clock, ArrowLeft, ArrowRight, Share2, BookOpen } from "lucide-react";

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string[];
  category: string;
  date: string;
  author: string;
  readTime: string;
  image: string;
}

const BLOG_POSTS: BlogPost[] = [
  {
    id: "1",
    title: "How to Download Twitter (X) Videos on iOS and Android: The Ultimate Guide",
    excerpt: "Learn how to bypass system restrictions and save high-resolution Twitter videos directly to your camera roll or system storage on any mobile device.",
    category: "Guides",
    date: "June 22, 2026",
    author: "Femi Michael",
    readTime: "4 min read",
    image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=600&q=80",
    content: [
      "Downloading media from Twitter (X) has always been notoriously complicated for mobile users. Since Twitter doesn't offer a native 'save video' button, third-party web tools like QuickSave are crucial for social creators and digital curators.",
      "For iPhone users running iOS 15 or newer, the process is streamlined because Safari now features a fully functional native download manager. You simply copy the tweet link, paste it into QuickSave, choose your resolution, and tap download. The file is saved directly into your iCloud Downloads directory, from where you can easily save it to your Photos Library.",
      "Android users can follow a very similar pattern. By using Chrome or any standard browser, QuickSave extracts high-speed stream paths, prompting a direct download. The video will be saved directly inside your system 'Downloads' folder, instantly visible in Google Photos, Samsung Gallery, or any file management utility.",
      "Always ensure you are respecting content creators' copyright before downloading. QuickSave serves as an open utility for offline viewing, archiving, and research purposes."
    ]
  },
  {
    id: "2",
    title: "Understanding Twitter's Video Streaming Formats and Why Converters Exist",
    excerpt: "An in-depth look at HLS streams, MPEG-TS chunks, and the reverse proxy technology needed to package social media streams into download-ready MP4 files.",
    category: "Technology",
    date: "June 18, 2026",
    author: "Femi Michael",
    readTime: "6 min read",
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80",
    content: [
      "Have you ever wondered why you cannot simply right-click and save a video on Twitter or Instagram? Unlike simple static MP4 assets, modern social platforms use segmented streaming protocols to ensure smooth playback across varying network conditions.",
      "Twitter primarily employs HTTP Live Streaming (HLS), which splits a video into thousands of tiny .ts (MPEG Transport Stream) file fragments, alongside a master .m3u8 playlist file. The playlist file acts as an index, directing your browser to download the next fragment depending on your current bandwidth.",
      "When you use a high-fidelity downloader like QuickSave, our server-side engine executes a reverse-metadata lookup. It reads the master playlist, chooses the highest possible bitrate index (like 1080p), and dynamically stitches these segmented chunks back into a unified, range-aware, and highly-seekable MP4 container in real-time.",
      "This process requires range-aware proxies to prevent hotlinking protection filters from breaking the download halfway. That's why QuickSave features an advanced streaming pipeline that ensures fast, uninterrupted downloads."
    ]
  },
  {
    id: "3",
    title: "How to Save High-Quality Instagram Reels and Carousels Instantly",
    excerpt: "Discover the correct steps to extract and download high-bitrate video streams and high-resolution slides from public Instagram accounts in one tap.",
    category: "Tutorials",
    date: "June 12, 2026",
    author: "Femi Michael",
    readTime: "3 min read",
    image: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=600&q=80",
    content: [
      "Instagram Reels have exploded in popularity, serving as a hub for viral trends, memes, and educational clips. However, saving these high-bitrate clips for mood boards or offline reference can be tricky due to Instagram's closed ecosystem.",
      "To extract Instagram Reels using QuickSave, copy the Reels link from the three-dots menu or the paper-airplane icon. Paste it into the input field at the top of our page. QuickSave's backend will analyze the URL, locate the direct media CDN path, and provide a range-aware streaming download button.",
      "For carousel posts (posts containing multiple photos or videos), QuickSave handles the request by serving a custom multi-media picker layout. You can preview each segment of the carousel separately and choose exactly which slides or clips you want to download.",
      "Remember that direct extraction only works for public Instagram posts. Locked private accounts restrict API access, which ensures privacy and compliance with user guidelines."
    ]
  }
];

export default function BlogView() {
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [copiedArticle, setCopiedArticle] = useState(false);

  const handleCopyArticleLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedArticle(true);
    setTimeout(() => setCopiedArticle(false), 2000);
  };

  return (
    <div className="space-y-10 py-4 animate-fade-in" id="blog-view-root">
      <AnimatePresence mode="wait">
        {!selectedPost ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-10"
            id="blog-list-container"
          >
            {/* Blog Header */}
            <div className="text-center space-y-3 max-w-2xl mx-auto" id="blog-header">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                <BookOpen className="h-3 w-3" /> Resources & Insights
              </span>
              <h1 className="text-2xl md:text-3xl font-semibold font-display tracking-tight text-gray-950 dark:text-white">
                The QuickSave Creator Hub
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base leading-relaxed font-light">
                Stay updated with the latest social media guides, technical insights, and optimization tips for managing and downloading social content.
              </p>
            </div>

            {/* Post Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" id="blog-posts-grid">
              {BLOG_POSTS.map((post) => (
                <article
                  key={post.id}
                  className="flex flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xs dark:border-gray-800 dark:bg-gray-900 transition-all hover:shadow-md cursor-pointer"
                  onClick={() => setSelectedPost(post)}
                  id={`blog-card-${post.id}`}
                >
                  <div className="relative h-48 w-full overflow-hidden bg-gray-100">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4 rounded-full bg-white/90 backdrop-blur-xs px-3 py-1 text-xs font-semibold text-blue-600 dark:bg-gray-900/90 dark:text-blue-400">
                      {post.category}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-6 space-y-4">
                    <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> {post.date}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {post.readTime}
                      </span>
                    </div>
                    <div className="space-y-2 flex-grow">
                      <h3 className="text-base font-semibold font-display text-gray-950 dark:text-white leading-snug hover:text-blue-600 transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed font-light">
                        {post.excerpt}
                      </p>
                    </div>
                    <div className="pt-2 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
                      <span>Read Full Article</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="article"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="max-w-3xl mx-auto space-y-8"
            id="blog-article-container"
          >
            {/* Back Button */}
            <button
              onClick={() => setSelectedPost(null)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white cursor-pointer"
              id="blog-back-btn"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Articles
            </button>

            {/* Featured Image */}
            <div className="relative h-64 md:h-96 w-full overflow-hidden rounded-3xl bg-gray-100 shadow-sm">
              <img
                src={selectedPost.image}
                alt={selectedPost.title}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-6 left-6 rounded-full bg-white/90 backdrop-blur-xs px-4 py-1.5 text-xs font-semibold text-blue-600 dark:bg-gray-900/90 dark:text-blue-400">
                {selectedPost.category}
              </div>
            </div>

            {/* Article Header */}
            <div className="space-y-4" id="article-heading-block">
              <h1 className="text-2xl md:text-3xl font-semibold font-display tracking-tight text-gray-950 dark:text-white leading-tight">
                {selectedPost.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-4 md:gap-6 text-xs text-gray-500 dark:text-gray-400 font-mono border-y border-gray-100/80 py-3 dark:border-gray-800">
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-blue-500" /> By {selectedPost.author}
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-purple-500" /> {selectedPost.date}
                </span>
                <span className="hidden sm:inline">•</span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-pink-500" /> {selectedPost.readTime}
                </span>
              </div>
            </div>

            {/* Article Content */}
            <div className="space-y-6 text-sm md:text-base text-gray-600 dark:text-gray-300 leading-relaxed font-light" id="article-body-content">
              {selectedPost.content.map((paragraph, index) => (
                <p key={index} className="indent-0">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Newsletter or Info Callout Card */}
            <div className="rounded-3xl border border-blue-50/50 bg-blue-50/20 p-6 md:p-8 dark:border-blue-950/40 dark:bg-blue-950/10 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center sm:text-left">
                <h4 className="font-semibold font-display text-gray-950 dark:text-white">Did this guide help you?</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md font-light">
                  Share this article with fellow creators or bookmark QuickSave for easy, instant, and unlimited video downloads whenever you need them.
                </p>
              </div>
              <button 
                onClick={handleCopyArticleLink}
                className="shrink-0 flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer shadow-xs shadow-blue-500/10"
              >
                {copiedArticle ? (
                  <>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-3.5 w-3.5" /> Share Article
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
