/**
 * Parse user-agent en device + os + browser
 * Léger et sans dépendance externe.
 */

export type DeviceInfo = {
  device: "mobile" | "tablet" | "desktop";
  os: string;
  browser: string;
};

export function parseUserAgent(ua: string | null | undefined): DeviceInfo {
  if (!ua) {
    return { device: "desktop", os: "Unknown", browser: "Unknown" };
  }

  const lower = ua.toLowerCase();

  // Device
  let device: DeviceInfo["device"] = "desktop";
  if (/tablet|ipad/.test(lower)) device = "tablet";
  else if (/mobile|android|iphone|ipod/.test(lower)) device = "mobile";

  // OS
  let os = "Unknown";
  if (/windows nt 10/.test(lower)) os = "Windows 10";
  else if (/windows nt 11/.test(lower)) os = "Windows 11";
  else if (/windows nt/.test(lower)) os = "Windows";
  else if (/mac os x|macintosh/.test(lower)) os = "macOS";
  else if (/iphone os|cpu os/.test(lower)) {
    const m = ua.match(/OS (\d+)_(\d+)/);
    os = m ? `iOS ${m[1]}.${m[2]}` : "iOS";
  } else if (/ipad/.test(lower)) os = "iPadOS";
  else if (/android/.test(lower)) {
    const m = ua.match(/Android (\d+(\.\d+)?)/);
    os = m ? `Android ${m[1]}` : "Android";
  } else if (/linux/.test(lower)) os = "Linux";

  // Browser
  let browser = "Unknown";
  if (/edg\//.test(lower)) browser = "Edge";
  else if (/chrome\//.test(lower) && !/edg|opr/.test(lower)) browser = "Chrome";
  else if (/firefox\//.test(lower)) browser = "Firefox";
  else if (/safari\//.test(lower) && !/chrome|chromium/.test(lower))
    browser = "Safari";
  else if (/opr\/|opera\//.test(lower)) browser = "Opera";

  return { device, os, browser };
}