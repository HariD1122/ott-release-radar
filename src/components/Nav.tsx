"use client";

import { Search, Bookmark, Clapperboard, Home, ListVideo, LogOut, Radar, Send, Settings, SlidersHorizontal, Tv } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/new", label: "New Releases", icon: Radar },
  { href: "/movies", label: "Movies", icon: Clapperboard },
  { href: "/series", label: "Series", icon: Tv },
  { href: "/episodes", label: "Episodes", icon: ListVideo },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/digest", label: "Weekly Digest", icon: Send },
  { href: "/profile", label: "Profile", icon: SlidersHorizontal },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Nav({ name }: { name: string }) {
  const path = usePathname();
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
          <Radar className="text-accent" size={20} aria-hidden /> <span className="hidden sm:inline">OTT Release Radar</span>
        </Link>
        <nav aria-label="Main" className="row-scroll flex flex-1 gap-1 overflow-x-auto">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm ${active ? "bg-surface2 text-accent" : "text-muted hover:text-ink"}`}
              >
                <Icon size={15} aria-hidden /> {label}
              </Link>
            );
          })}
        </nav>
        <form action="/" method="get" role="search" className="relative hidden lg:block">
          <Search size={14} className="absolute left-2.5 top-2.5 text-muted" aria-hidden />
          <input name="q" aria-label="Search catalogue" placeholder="Search titles" className="input !py-1.5 !pl-8 w-44" />
        </form>
        <span className="hidden text-xs text-muted xl:inline">{name}</span>
        <button className="btn !px-2.5 !py-1.5" onClick={logout} aria-label="Log out">
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
}
