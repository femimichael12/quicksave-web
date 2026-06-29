/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Link, Clipboard, ArrowDownToLine, Monitor, Smartphone, Tablet, Sparkles } from "lucide-react";
import { motion } from "motion/react";

export default function HowToDownload({ setActiveTab }: { setActiveTab?: (tab: string) => void }) {
  const steps = [
    {
      num: "1",
      title: "Copy the Link",
      desc: "Go to Twitter (X) or Instagram. Tap on the Share icon below the post or video, and choose 'Copy Link' or 'Copy URL' from the available options.",
      icon: Link,
      color: "from-blue-500 to-cyan-500",
    },
    {
      num: "2",
      title: "Paste the Link",
      desc: "Return to QuickSave. Paste the copied link into the input box at the top of the page, choose your preferred quality settings, and click 'Download'.",
      icon: Clipboard,
      color: "from-indigo-500 to-purple-500",
    },
    {
      num: "3",
      title: "Save the Video",
      desc: "Choose from the high-resolution direct download options available. Click the 'Download' button next to your desired resolution to save your media instantly.",
      icon: ArrowDownToLine,
      color: "from-pink-500 to-rose-500",
    },
  ];

  const devices = [
    {
      name: "Android Phone & Tablet",
      icon: Smartphone,
      steps: [
        "Open the Twitter (X) or Instagram app in your browser or native app.",
        "Locate the video or GIF you want to save, tap the Share icon, and choose 'Copy Link'.",
        "Open QuickSave in your mobile browser, paste the link, and tap download.",
        "Alternatively, use our app shortcuts or bookmarklet for rapid, instant one-tap downloads.",
      ],
    },
    {
      name: "iPhone & iPad (iOS)",
      icon: Tablet,
      steps: [
        "Copy the media link from Twitter/X or Instagram in your native iOS app.",
        "Paste the link into QuickSave using Safari or Chrome browser on your iOS device.",
        "Tap 'Download', choose your quality, and the direct video stream will open.",
        "For iOS 13+, tap the share sheet in Safari and select 'Save to Files' to add it directly to your camera roll.",
      ],
    },
    {
      name: "Desktop and Laptop",
      icon: Monitor,
      steps: [
        "In your desktop browser (Chrome, Safari, Firefox, Edge), copy the direct URL of the tweet or Instagram post.",
        "Paste the copied URL in the big input field on QuickSave and click the blue 'Download' button.",
        "Your download starts immediately and is saved directly to your default Downloads folder in full HD.",
      ],
    },
  ];

  return (
    <div className="space-y-16 py-12" id="howto-section">
      
      {/* 3 Step Process */}
      <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm transition-colors duration-300 dark:border-gray-900 dark:bg-gray-950" id="howto-steps">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h2 className="text-2xl md:text-3xl font-semibold font-display tracking-tight text-gray-950 dark:text-white">
            How to Download Social Videos
          </h2>
          <p className="mt-4 text-base md:text-lg text-gray-500 dark:text-gray-400 font-light">
            Downloading videos and GIFs from Twitter (X) and Instagram is an absolute breeze using QuickSave. Just follow these three simple steps:
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3" id="howto-steps-grid">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                key={step.num}
                className="relative flex flex-col items-center text-center p-6 rounded-2xl border border-gray-100 hover:border-blue-100 hover:bg-blue-50/10 dark:border-gray-900 dark:hover:border-blue-950/40 dark:hover:bg-blue-950/5 group transition-all"
                id={`step-card-${step.num}`}
              >
                {/* Number Badge */}
                <span className="absolute top-4 left-4 flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                  {step.num}
                </span>

                {/* Animated Icon */}
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr ${step.color} text-white shadow-lg mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="h-7 w-7" />
                </div>

                <h3 className="text-lg font-semibold font-display text-gray-950 dark:text-white mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Device Support Guide */}
      <section className="space-y-8" id="howto-devices">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold font-display tracking-tight text-gray-950 dark:text-white">
            Download Videos on Any Device
          </h2>
          <p className="mt-3 text-base text-gray-500 dark:text-gray-400 font-light">
            QuickSave is fully web-based and runs flawlessly on any platform with a web browser. No software installs required.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3" id="howto-devices-grid">
          {devices.map((device, idx) => {
            const Icon = device.icon;
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                key={device.name}
                className="flex flex-col bg-white border border-gray-100 rounded-2xl p-6 shadow-sm dark:bg-gray-950 dark:border-gray-900"
                id={`device-card-${idx}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold font-display text-gray-950 dark:text-white">
                    {device.name}
                  </h3>
                </div>

                <ul className="space-y-3 flex-grow">
                  {device.steps.map((stepText, stepIdx) => (
                    <li key={stepIdx} className="flex gap-2.5 items-start text-sm text-gray-500 dark:text-gray-400 font-light">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-700 dark:bg-gray-900 dark:text-gray-400 mt-0.5">
                        {stepIdx + 1}
                      </span>
                      <span>{stepText}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Call to action for Downloader */}
      <motion.div
        initial={{ scale: 0.98, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true }}
        className="rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-700 p-8 md:p-12 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-8"
        id="howto-cta"
      >
        <div className="space-y-4 max-w-xl text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/30 px-3.5 py-1 text-xs font-medium backdrop-blur-sm">
            <ArrowDownToLine className="h-3 w-3 text-blue-200" /> Start Downloading Now
          </div>
          <h3 className="text-2xl md:text-3xl font-semibold font-display tracking-tight">
            Ready to Save Social Media Content?
          </h3>
          <p className="text-blue-100 text-sm md:text-base leading-relaxed font-light">
            Get your high-resolution videos and animated GIFs instantly from Twitter (X) and Instagram. No registration, completely free, and unlimited speeds.
          </p>
        </div>
        <button
          onClick={() => {
            if (setActiveTab) {
              setActiveTab("download");
            }
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="shrink-0 bg-white text-blue-600 font-semibold px-8 py-3.5 rounded-2xl shadow-md hover:bg-blue-50 transition-all active:scale-95 cursor-pointer"
          id="howto-cta-btn"
        >
          Go to Downloader
        </button>
      </motion.div>

    </div>
  );
}
