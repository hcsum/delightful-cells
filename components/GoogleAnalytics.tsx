"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

const measurementId =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-2T7ZPCY2RM";

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const initialPageView = useRef(true);

  useEffect(() => {
    if (initialPageView.current) {
      initialPageView.current = false;
      return;
    }
    if (!window.gtag) return;
    window.gtag("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname]);

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
