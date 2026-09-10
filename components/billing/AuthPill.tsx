"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/useAuth";
import { useLocale, useT } from "@/lib/cells/locale";
import { localizePath } from "@/lib/locale-routing";

// Sign in / avatar, styled for the light Cells chrome (HeaderAuth is the dark
// AppShell version). Signed in, the avatar links to the account page.
export default function AuthPill() {
  const { user, isAuthenticated, isLoading, signInWithGoogle } = useAuth();
  const locale = useLocale();
  const t = useT();

  if (isLoading) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-black/5" aria-hidden />;
  }

  if (!isAuthenticated) {
    return (
      <button
        type="button"
        onClick={() => signInWithGoogle(currentPath())}
        className="inline-flex items-center rounded-full border !border-black/15 bg-white px-3 py-1.5 text-xs font-semibold !text-black/70 hover:bg-[#fff3d6]"
      >
        {t("signIn")}
      </button>
    );
  }

  const name = (user?.name || user?.email || "You") as string;
  const img = (user as any)?.image as string | undefined;
  return (
    <Link href={localizePath("/account", locale)} title={name} className="shrink-0">
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt={name}
          referrerPolicy="no-referrer"
          className="h-8 w-8 rounded-full border !border-black/15 object-cover"
        />
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-full border !border-black/15 bg-white text-xs font-bold text-black/70">
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </Link>
  );
}

export function currentPath(): string {
  if (typeof window === "undefined") return "/";
  const { pathname, search } = window.location;
  return `${pathname || "/"}${search || ""}`;
}
