import { openUrl } from '@tauri-apps/plugin-opener';

export const DEFAULT_WEBSITE_URL = 'https://spytify-website-rho.vercel.app';

export function getWebsiteUrl(): string {
  try {
    const custom = localStorage.getItem('spytify_vercel_url');
    if (custom && custom.trim()) {
      return custom.trim();
    }
  } catch {}
  return DEFAULT_WEBSITE_URL;
}

export function setWebsiteUrl(url: string): void {
  try {
    const trimmed = url.trim();
    if (!trimmed || trimmed === DEFAULT_WEBSITE_URL) {
      localStorage.removeItem('spytify_vercel_url');
    } else {
      localStorage.setItem('spytify_vercel_url', trimmed);
    }
  } catch {}
}

export async function openWebsite(targetUrl?: string): Promise<void> {
  const url = targetUrl || getWebsiteUrl();
  try {
    await openUrl(url);
  } catch (err) {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {}
  }
}
