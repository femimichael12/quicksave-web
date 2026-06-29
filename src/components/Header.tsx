/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Globe, Moon, Sun, Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";


interface HeaderProps {
  darkMode: boolean;
  toggleDarkMode: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Header({ darkMode, toggleDarkMode, activeTab, setActiveTab }: HeaderProps) {
  const [showLanguages, setShowLanguages] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
 const { t, i18n } = useTranslation();
 
  

  const navItems = [
    { id: "download", label: "Home" },
    { id: "blog", label: "Blog" },
    { id: "screenshot", label: "Generate Screenshot" },
    { id: "more", label: "More" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-transparent px-4 sm:px-6 lg:px-8 pt-4 pb-2" id="header-main">
      <div 
        className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6 bg-white/95 border border-gray-100 dark:border-gray-800/80 rounded-full shadow-xs backdrop-blur-md transition-colors duration-300 dark:bg-gray-900/95"
        id="header-inner"
      >
        {/* Brand Section */}
        <div 
          className="flex items-baseline gap-0.5 cursor-pointer select-none py-1 transition-transform duration-300 hover:scale-102" 
          onClick={() => setActiveTab("download")} 
          id="brand-logo-container"
        >
          <span className="text-2xl font-black font-sans text-blue-600 dark:text-blue-500 tracking-tighter leading-none select-none" id="brand-logo-q">
            Q
          </span>
          <span className="text-xl font-bold tracking-tight text-gray-950 dark:text-white font-sans leading-none" id="brand-name-suffix">
            uickSave 
          </span>
        </div>

        {/* Desktop Nav Items */}
        <nav className="hidden md:flex items-center gap-1.5" id="desktop-nav">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`relative px-4 py-1.5 text-sm font-medium transition-colors duration-200 select-none ${
                  isActive
                    ? "text-gray-950 dark:text-white"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-nav-bg"
                    className="absolute inset-0 rounded-lg bg-[#e6f4fe] dark:bg-blue-950/50 -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Header Action Buttons matching the image */}
        <div className="hidden md:flex items-center gap-2" id="header-actions">
          {/* Language Selector button (Globe in square rounded border) */}
        <button
  id="lang-selector-btn"
  onClick={() => setShowLanguages(!showLanguages)}
  className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-500 hover:bg-gray-50 transition-colors dark:border-gray-800 dark:bg-[#0B1736] dark:hover:bg-[#13204A]"
  title="Language"
>
  <Globe className="h-4.5 w-4.5" />
</button>
  {showLanguages && (
  <div className="absolute top-12 right-0 w-40 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-2 z-50">
    <button
  className="block w-full text-left px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
  onClick={() => {
    i18n.changeLanguage("en");
    setShowLanguages(false);
  }}
>
  English
</button>
   <button
  className="block w-full text-left px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
  onClick={() => {
    i18n.changeLanguage("fr");
    setShowLanguages(false);
  }}
>
  Français
</button>

<button
  className="block w-full text-left px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
  onClick={() => {
    i18n.changeLanguage("es");
    setShowLanguages(false);
  }}
>
  Español
</button>
  </div>
)}

          {/* Theme toggle (Moon/Sun in square rounded border) */}
          <button
            id="theme-toggle-btn"
            onClick={toggleDarkMode}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-all cursor-pointer"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>
        </div>

        {/* Mobile controls */}
        <div className="flex md:hidden items-center gap-1.5" id="mobile-controls">
          <button
            id="mobile-theme-toggle"
            onClick={toggleDarkMode}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-100 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            id="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-100 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {isMobileMenuOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute left-4 right-4 top-18 z-40 rounded-2xl border border-gray-100 bg-white/95 p-4 shadow-lg backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/95"
            id="mobile-nav-container"
          >
            <div className="flex flex-col gap-1.5">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`mobile-nav-tab-${item.id}`}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#e6f4fe] text-gray-950 dark:bg-blue-950/50 dark:text-white"
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
              <div className="flex items-center justify-between border-t border-gray-100/80 pt-2.5 mt-2.5 dark:border-gray-800">
                <span className="text-xs text-gray-400 dark:text-gray-500">Language</span>
                <button className="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
                  <Globe className="h-3.5 w-3.5" /> English
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
