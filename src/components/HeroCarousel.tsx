"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export interface Slide {
  id: string;
  title: string;
  type: string;
  meta: string;
  synopsis: string | null;
  image: string;
}

/** Featured-titles carousel for the top of the site. Auto-advances, pauses on hover/focus, honours reduced motion. */
export default function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;

  useEffect(() => {
    if (paused || n < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 6000);
    return () => clearInterval(t);
  }, [paused, n]);

  if (!n) return null;
  const go = (d: number) => setI((x) => (x + d + n) % n);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured releases"
      className="relative mb-10 h-[340px] overflow-hidden rounded-xl bg-slate-900 shadow-md sm:h-[400px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {slides.map((s, idx) => {
        const active = idx === i;
        return (
          <div
            key={s.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${idx + 1} of ${n}: ${s.title}`}
            aria-hidden={!active}
            className={`absolute inset-0 transition-opacity duration-700 ${active ? "z-10 opacity-100" : "pointer-events-none opacity-0"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.image} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_25%]" loading={idx === 0 ? "eager" : "lazy"} />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="relative flex h-full max-w-xl flex-col justify-end gap-2 p-6 pb-8 text-white sm:p-10 sm:pb-12">
              <span className="w-fit rounded bg-accent px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">{s.type}</span>
              <h2 className="line-clamp-2 text-2xl font-extrabold leading-tight sm:text-4xl">{s.title}</h2>
              <p className="line-clamp-1 text-sm font-medium text-white/90">{s.meta}</p>
              {s.synopsis && <p className="line-clamp-2 hidden text-sm leading-relaxed text-white/80 sm:block">{s.synopsis}</p>}
              <Link
                href={`/title/${s.id}`}
                tabIndex={active ? 0 : -1}
                className="mt-2 inline-flex w-fit items-center rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#084f9f]"
              >
                View details
              </Link>
            </div>
          </div>
        );
      })}

      {n > 1 && (
        <>
          <div className="absolute bottom-4 right-4 z-20 hidden items-center gap-2 md:flex">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Show ${s.title}`}
                aria-current={idx === i}
                onClick={() => setI(idx)}
                className={`h-[54px] w-24 overflow-hidden rounded border-2 transition ${idx === i ? "border-white" : "border-transparent opacity-70 hover:opacity-100"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
            <button type="button" aria-label="Next featured title" onClick={() => go(1)} className="ml-1 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70">
              <ChevronRight size={22} />
            </button>
          </div>
          <button type="button" aria-label="Previous featured title" onClick={() => go(-1)} className="absolute left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/70 sm:flex">
            <ChevronLeft size={22} />
          </button>
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 md:hidden">
            {slides.map((s, idx) => (
              <button key={s.id} type="button" aria-label={`Go to slide ${idx + 1}`} aria-current={idx === i} onClick={() => setI(idx)} className={`h-2 rounded-full transition-all ${idx === i ? "w-5 bg-white" : "w-2 bg-white/50"}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
