/** Minified Lucide-style headphones on primary green; used for OG/favicon rasterization. */
export const BRAND_HEADPHONE_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#2f8f6a"/><g transform="translate(4 4)"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" fill="none" stroke="#fafafa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g></svg>'

export function brandHeadphoneIconDataUrl(): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(BRAND_HEADPHONE_ICON_SVG)}`
}
