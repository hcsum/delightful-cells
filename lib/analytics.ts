type AnalyticsValue = string | number | boolean;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(
  name: string,
  params: Record<string, AnalyticsValue | undefined> = {},
) {
  if (typeof window === "undefined" || !window.gtag) return;

  const safeParams = Object.fromEntries(
    Object.entries(params).filter(
      (entry): entry is [string, AnalyticsValue] => entry[1] !== undefined,
    ),
  );
  window.gtag("event", name, safeParams);
}
