/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PickerItem {
  url: string;
  type: "video" | "photo" | "audio" | "gif";
  thumb?: string;
}

export interface DownloadResult {
  status: "redirect" | "stream" | "picker" | "error";
  url?: string;
  picker?: PickerItem[];
  text?: string;
  title?: string;
  thumb?: string;
  filename?: string;
  error?: string | { code: string };
}

export interface MarketingBundle {
  caption: string;
  tweet: string;
  hashtags: string[];
  summary: string;
  hook: string;
}

export type Platform = "twitter" | "instagram" | "youtube" | "tiktok" | "unknown";
