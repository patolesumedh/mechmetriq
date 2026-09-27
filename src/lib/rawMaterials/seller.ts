import "server-only";

/**
 * The platform is the seller of record on raw-material proformas.
 * Set these in Vercel → Settings → Environment Variables before go-live.
 */
export function sellerDetails() {
  return {
    legalName: process.env.RM_SELLER_LEGAL_NAME || "MECHmetrIQ",
    gstin: process.env.RM_SELLER_GSTIN || null,
    address: process.env.RM_SELLER_ADDRESS || null,
    email: process.env.RM_SELLER_EMAIL || "hello@mechmetriq.com",
  };
}
