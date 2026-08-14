/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Facebook, Twitter, Youtube } from "lucide-react";

export default function Footer({ setActiveTab }: { setActiveTab: (tab: string) => void }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-gray-50 text-gray-600 transition-colors duration-300" id="footer-main">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5" id="footer-grid">
          
          {/* Logo & Description Column */}
          <div className="lg:col-span-2" id="footer-brand-col">
            <div className="flex items-baseline gap-0.5 mb-4 cursor-pointer select-none" onClick={() => setActiveTab("download")} id="footer-logo">
              <span className="text-2xl font-black font-sans text-blue-600 tracking-tighter leading-none select-none" id="footer-logo-q">
                Q
              </span>
              <span className="text-xl font-bold font-sans tracking-tight text-gray-900 leading-none">
                uickSave
              </span>
            </div>
            <p className="text-sm leading-relaxed text-gray-500 mb-6 max-w-md">
              We are not affiliated or endorsed by Twitter/X, Instagram, YouTube, or TikTok. We do not host any video, photo, or audio media on our servers. All fetched media files are downloaded directly from their respective content delivery networks. All rights belong to their respective owners.
            </p>
            <div className="flex items-center gap-3" id="footer-socials">
              <a href="#" className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                <Facebook className="h-4 w-4" />
              </a>
              <a href="https://x.com/FemiMichaell" className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="#" className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                <Youtube className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Legal Column */}
          <div id="footer-legal-col">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 mb-4">
              Legal
            </h3>
            <p className="text-xs text-gray-400 mb-3 leading-relaxed">
              By using QuickSave to download media you agree to our Terms.
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-blue-600 transition-colors">About Us</a>
              </li>
              <li>
                <a href="#" className="hover:text-blue-600 transition-colors">Privacy Policy</a>
              </li>
              <li>
                <a href="#" className="hover:text-blue-600 transition-colors">Terms of Service</a>
              </li>
              <li>
                <a href="https://wa.me/2348129697419" className="hover:text-blue-600 transition-colors">Contact Us</a>
              </li>
            </ul>
          </div>

          {/* Quick Links / Our Sites */}
          <div id="footer-sites-col">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 mb-4">
              Our Portals
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button onClick={() => setActiveTab("download")} className="text-left hover:text-blue-600 transition-colors cursor-pointer">
                  Twitter Video Downloader
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab("download")} className="text-left hover:text-blue-600 transition-colors cursor-pointer">
                  Instagram Downloader
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab("download")} className="text-left hover:text-blue-600 transition-colors cursor-pointer">
                  YouTube Downloader
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab("download")} className="text-left hover:text-blue-600 transition-colors cursor-pointer">
                  TikTok Downloader
                </button>
              </li>
            </ul>
          </div>

          {/* Resources Column */}
          <div id="footer-resources-col">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-900 mb-4">
              Resources
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button onClick={() => setActiveTab("how-to")} className="text-left hover:text-blue-600 transition-colors cursor-pointer">
                  How to Download
                </button>
              </li>
              <li>
                <a href="#" className="hover:text-blue-600 transition-colors">Troubleshooting</a>
              </li>
              <li>
                <a href="#" className="hover:text-blue-600 transition-colors">Android App</a>
              </li>
              <li>
                <a href="#" className="hover:text-blue-600 transition-colors">iOS Mobile Guide</a>
              </li>
            </ul>
          </div>

        </div>

        <div className="border-t border-gray-200 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between text-xs text-gray-400" id="footer-bottom-bar">
          <p>© {currentYear} FemiMichael</p>
        </div>
      </div>
    </footer>
  );
}

