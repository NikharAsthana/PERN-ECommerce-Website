/*  
    Optimized images are essential for a fast, bandwidth‑friendly web experience. 
    Unoptimized ones slow things down and can hurt the business.
    The trick is to keep a single original URL in the database and generate size‑specific, optimized versions on the fly via URL transformations. 
    For instance, catalog cards can request a medium image, carts a small thumbnail, product pages a larger one, 
    and admin tables a tiny preview—all without uploading multiple copies. 
*/

/**
 * Text overlay (brand watermark). Chained after base transforms with ":".
 * @see https://imagekit.io/docs/add-overlays-on-images
 */
function buildNeoBuyTextLayer({ w, h }) {
  const maxDim = Math.max(w != null && w > 0 ? w : 0, h != null && h > 0 ? h : 0, 200);
  let fs;
  if (maxDim <= 180) fs = 11;
  else if (maxDim <= 240) fs = 13;
  else if (maxDim <= 400) fs = 16;
  else if (maxDim <= 700) fs = 22;
  else fs = 30;
  return `l-text,i-Neobuy,fs-${fs},co-FFFFFF,bg-0F172A90,pa-8_12,lx-N14,ly-14,lap-top_right,l-end`;
}

/**
 * Build ImageKit transformation path segment (resize, crop, quality, format).
 * @see https://imagekit.io/docs/image-optimization
 * @see https://imagekit.io/docs/image-resize-and-crop
 * @param {{ w?: number; h?: number; q?: number; f?: string; crop?: "at_max" | "maintain_ratio"; watermark?: boolean }} opts
 */
function buildTrSegment({ w, h, q = 80, f = "auto", crop, watermark = false }) {
  const parts = [];
  if (w != null && w > 0) parts.push(`w-${Math.round(w)}`);
  if (h != null && h > 0) parts.push(`h-${Math.round(h)}`);
  // With both w and h, ImageKit defaults to c-maintain_ratio (center crop). For product photos we
  // prefer c-at_max: full image inside the box, no CDN crop; CSS object-cover handles framing.
  if (w != null && w > 0 && h != null && h > 0) {
    const mode = crop ?? "at_max";
    parts.push(`c-${mode}`);
  }
  parts.push(`q-${Math.min(100, Math.max(1, Math.round(q)))}`);
  parts.push(`f-${f}`);
  const base = `tr:${parts.join(",")}`;
  if (!watermark) return base;
  return `${base}:${buildNeoBuyTextLayer({ w, h })}`;
}

/**
 * @param {string} url
 * @returns {boolean}
 */
function isImageKitDeliveryUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("ik.imagekit.io")) return true;
    const endpoint = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT?.replace(/\/$/, "");
    if (endpoint && url.startsWith(endpoint)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Applies ImageKit URL transformations for smaller, auto-formatted images.
 * Non-ImageKit URLs are returned unchanged (e.g. legacy external images).
 *
 * @param {string | null | undefined} url
 * @param {{ w?: number; h?: number; q?: number; f?: string; crop?: "at_max" | "maintain_ratio"; watermark?: boolean }} [opts]
 * @returns {string | undefined}
 */
export function imageKitOptimizedUrl(url, opts = {}) {
  if (url == null || url === "") return url ?? undefined;
  if (typeof url !== "string" || !isImageKitDeliveryUrl(url)) return url;

  const tr = buildTrSegment(opts);

  try {
    const u = new URL(url);

    if (u.hostname.endsWith("ik.imagekit.io")) {
      const segments = u.pathname.split("/").filter(Boolean);
      if (segments.length < 2) return url;
      const id = segments[0];
      const rest = segments.slice(1);
      while (rest.length && rest[0].toLowerCase().startsWith("tr")) {
        rest.shift();
      }
      if (!rest.length) return url;
      u.pathname = `/${id}/${tr}/${rest.join("/")}`;
      return u.toString();
    }

    const endpoint = import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT?.replace(/\/$/, "");
    if (endpoint && url.startsWith(endpoint)) {
      const epUrl = new URL(endpoint);
      const basePath = epUrl.pathname.replace(/\/$/, "") || "";
      if (!u.pathname.startsWith(basePath)) return url;
      const rel = u.pathname.slice(basePath.length).replace(/^\//, "");
      const relSegs = rel.split("/").filter(Boolean);
      while (relSegs.length && relSegs[0].toLowerCase().startsWith("tr")) {
        relSegs.shift();
      }
      if (!relSegs.length) return url;
      u.pathname = `${basePath}/${tr}/${relSegs.join("/")}`;
      return u.toString();
    }

    return url;
  } catch {
    return url;
  }
}

/**
 * Same optimizations as {@link imageKitOptimizedUrl} plus neobuy text overlay (for share/download).
 * Non-ImageKit URLs are returned unchanged.
 */
export function imageKitWatermarkedUrl(url, opts = {}) {
  return imageKitOptimizedUrl(url, { ...opts, watermark: true });
}

/** Presets aligned to layout (2× for retina where useful). */
export const IK_PRESETS = {
  /** Catalog cards ~4:3, max column ~400px */
  catalogCard: { w: 800, h: 600, q: 80, f: "auto" },
  /** Product detail hero */
  productHero: { w: 1200, h: 1200, q: 82, f: "auto" },
  /** Admin table ~56–72px boxes */
  adminThumb: { w: 144, h: 144, q: 80, f: "auto" },
  /** Cart line h-24 w-24 */
  cartThumb: { w: 192, h: 192, q: 80, f: "auto" },
  /** Order summary thumbs */
  orderLineThumb: { w: 224, h: 224, q: 80, f: "auto" },
  /** Order list mosaic */
  orderPreviewMd: { w: 176, h: 176, q: 80, f: "auto" },
  orderPreviewLg: { w: 288, h: 288, q: 80, f: "auto" },
  /** Admin modal image preview (max-h-32) */
  formPreview: { w: 640, h: 320, q: 80, f: "auto" },
};