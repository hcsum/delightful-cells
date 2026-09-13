// The one host the site is indexed under. Middleware redirects every other
// hostname here, so canonical URLs, hreflang alternates and the sitemap must
// all be built from this and not from NEXT_PUBLIC_SITE_URL — that one is a
// build-time value used for OAuth and Stripe return URLs, and pointing a
// canonical at a hostname that 308s is a canonical that says "not this page".
export const PRIMARY_HOST = "delightfulcells.com";

export const SITE_URL = `https://${PRIMARY_HOST}`;
