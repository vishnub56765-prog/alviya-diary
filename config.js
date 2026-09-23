/**
 * ALVIYA DAIRY - Configuration & Constants
 * Production Milk Collection & Farmer Billing System
 */

export const CONFIG = {
  APP_NAME: 'ALVIYA DAIRY',
  APP_SUBTITLE: 'Quality Milk Collection & Farmer Billing',
  OWNER_LOGIN_ID: 'ALVIYA-MAIN',
  OWNER_EMAIL: 'vishnub56765@gmail.com',
  DEFAULT_TS: 2.80,
  STORE_KEY: 'alviyaDairy_product_cache_v1',
  SUPABASE_URL: 'https://ibmjejholctojmuvvyip.supabase.co',
  SUPABASE_KEY: 'sb_publishable_3PCmPoXxR38JKVCEukhKrQ_tQrFg5ds'
};

/**
 * Deterministic email generator for center owner logins in Supabase Auth
 * Center owners log in using Center ID (e.g. KARUR01) and password.
 */
export function centerLoginEmail(code) {
  const clean = String(code || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return `${clean}@centers.alviyadairy.local`;
}
