"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, type ReactNode } from "react";

/** Horizontal row of equal cards with left/right buttons, like a streaming-site shelf. */
export default function ScrollRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" });
  const btn =
    "absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white text-ink shadow-md hover:bg-surface2 md:flex";
  return (
    <div className="relative">
      <div ref={ref} className="row-scroll flex items-stretch gap-4 overflow-x-auto px-1 pb-4 pt-1">
        {children}
      </div>
      <button type="button" aria-label="Scroll left" className={`${btn} -left-3`} onClick={() => scroll(-1)}>
        <ChevronLeft size={20} />
      </button>
      <button type="button" aria-label="Scroll right" className={`${btn} -right-3`} onClick={() => scroll(1)}>
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
