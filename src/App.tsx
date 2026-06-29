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
  const [darkMode, setDarkMode] = useState(false);

  // Initialize dark mode based on localStorage or user system preference
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (storedTheme === "dark" || (!storedTheme && systemPrefersDark)) {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleDarkMode = () => {
    if (darkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setDarkMode(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/40 text-gray-900 transition-colors duration-300 dark:bg-gray-950 dark:text-gray-100" id="app-root">
      {/* Redesigned Pill Header Navigation floating at the top */}
      <Header
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" id="app-main-content">
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
