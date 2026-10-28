"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const projectId = "z4ss1vo5v2";

export default function MicrosoftClarity() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const testTraffic = new URLSearchParams(window.location.search).get("test_traffic");
    let isTest = process.env.NODE_ENV !== "production" ||
      /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname) ||
      testTraffic === "1";
    try {
      if (testTraffic === "1") localStorage.setItem("analytics:test_traffic", "1");
      if (testTraffic === "0") localStorage.removeItem("analytics:test_traffic");
      isTest ||= localStorage.getItem("analytics:test_traffic") === "1";
    } catch {}
    setEnabled(!isTest);
  }, []);

  if (!enabled) return null;

  return (
    <Script id="microsoft-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window,document,"clarity","script","${projectId}");`}
    </Script>
  );
}
