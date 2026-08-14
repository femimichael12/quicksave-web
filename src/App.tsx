/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import Downloader from "./components/Downloader";
import BlogView from "./components/BlogView";
import ScreenshotGenerator from "./components/ScreenshotGenerator";
import MoreTools from "./components/MoreTools";
import HowToDownload from "./components/HowToDownload";
import Footer from "./components/Footer";

export default function App() {
  const [activeTab, setActiveTab] = useState("download");

  // Ensure document element never has dark class
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("theme");
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/40 text-gray-900 transition-colors duration-300" id="app-root">
      {/* Redesigned Pill Header Navigation floating at the top */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-10" id="app-main-content">
        {activeTab === "download" && (
          <Downloader />
        )}
        
        {activeTab === "blog" && (
          <BlogView />
        )}

        {activeTab === "screenshot" && (
          <ScreenshotGenerator />
        )}

        {activeTab === "more" && (
          <MoreTools />
        )}
        
        {activeTab === "how-to" && (
          <HowToDownload setActiveTab={setActiveTab} />
        )}
      </main>

      {/* Structured Site Footer */}
      <Footer setActiveTab={setActiveTab} />
    </div>
  );
}

