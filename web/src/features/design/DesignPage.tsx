import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/ui/ThemeToggle";
import { BlueprintConcept } from "./concepts/BlueprintConcept";
import { PixelConcept } from "./concepts/PixelConcept";
import { Playground } from "./playground/Playground";
import { useDesignParams } from "./useDesignParams";
import "./design.css";

/** Concept fonts load only when /design is open, so they never touch the real app. */
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=IBM+Plex+Mono:wght@400;500;600&family=Caveat:wght@500;700&family=Doto:wght@700;900&family=Hanken+Grotesk:wght@500;700;800&family=Barlow+Condensed:wght@500;600;700&display=swap";

/** `Component: null` means playground only (the showcase for today's style is the app itself). */
const CONCEPTS = [
  {
    id: "current",
    name: "Current",
    kind: "Today’s app style",
    swatch: ["#f7f5f0", "#ffffff", "#5b4fe0", "#1f9d63"],
    Component: null,
  },
  {
    id: "pixel",
    name: "NEET.SYS",
    kind: "Pixel / ASCII",
    swatch: ["#10121c", "#7cff6b", "#ffb000", "#ff4fd8"],
    Component: PixelConcept,
  },
  {
    id: "blueprint",
    name: "Drafting Office",
    kind: "Blueprint (surprise)",
    swatch: ["#123f86", "#ffffff", "#ffe08a", "#ff5a4f"],
    Component: BlueprintConcept,
  },
  {
    id: "synth",
    name: "Patchbay",
    kind: "Modular synth",
    swatch: ["#1b1c1f", "#ff5a4e", "#ffc93c", "#4cc9f0"],
    Component: null,
  },
  {
    id: "factory",
    name: "Factory",
    kind: "Pixel factory",
    swatch: ["#4a7c3a", "#8a8d91", "#ffb000", "#7a4b2a"],
    Component: null,
  },
  {
    id: "gameboy",
    name: "NEET·BOY",
    kind: "Game Boy",
    swatch: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
    Component: null,
  },
  {
    id: "transit",
    name: "Transit",
    kind: "Subway map",
    swatch: ["#f7f5ef", "#dc241f", "#0019a8", "#ffce00"],
    Component: null,
  },
] as const;

export function DesignPage() {
  const {
    concept,
    setConcept,
    playing: playParam,
    setPlaying,
  } = useDesignParams();
  const active = CONCEPTS.find((c) => c.id === concept) ?? CONCEPTS[0];
  const playing = playParam || !active.Component;

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONTS_HREF;
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  // Number keys switch tabs, ←/→ cycle, P flips showcase/playground.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey)
        return;
      const i = CONCEPTS.findIndex((c) => c.id === active.id);
      const n = Number(e.key);
      if (n >= 1 && n <= CONCEPTS.length) setConcept(CONCEPTS[n - 1].id);
      else if (e.key === "ArrowRight")
        setConcept(CONCEPTS[(i + 1) % CONCEPTS.length].id);
      else if (e.key === "ArrowLeft")
        setConcept(CONCEPTS[(i - 1 + CONCEPTS.length) % CONCEPTS.length].id);
      else if (e.key === "p") setPlaying(!playing);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex min-h-full flex-col">
      <div className="dz-tabs sticky top-0 z-50">
        <div className="dz-scroll flex items-center gap-1 overflow-x-auto px-3">
          <Link
            to="/"
            className="mr-2 flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-white/50 hover:text-white"
            title="Back to app"
          >
            <ArrowLeft size={14} /> app
          </Link>
          <div role="tablist" className="flex gap-1">
            {CONCEPTS.map((c, i) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={c.id === active.id}
                onClick={() => setConcept(c.id)}
                className={cn(
                  "dz-tab flex shrink-0 items-center gap-2.5 px-3 py-2.5",
                  c.id === active.id && "dz-tab-on",
                )}
              >
                <span className="flex overflow-hidden rounded-[4px] ring-1 ring-white/15">
                  {c.swatch.map((s) => (
                    <span
                      key={s}
                      className="h-4 w-2"
                      style={{ background: s }}
                    />
                  ))}
                </span>
                <span className="text-left leading-tight">
                  <span className="block text-[13px] font-semibold text-white">
                    {c.name}
                  </span>
                  <span className="block text-[11px] text-white/45">
                    {i + 1} · {c.kind}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 pl-4">
            {active.id === "current" && <ThemeToggle />}
            {active.Component && (
              <div className="dz-seg flex rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setPlaying(false)}
                  className={cn(
                    "dz-seg-btn rounded-md px-3 py-1.5",
                    !playing && "dz-seg-on",
                  )}
                >
                  Showcase
                </button>
                <button
                  onClick={() => setPlaying(true)}
                  className={cn(
                    "dz-seg-btn rounded-md px-3 py-1.5",
                    playing && "dz-seg-on",
                  )}
                >
                  Playground
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div key={`${active.id}-${playing}`} className="dz-stage flex-1">
        {playing ? (
          <Playground skin={active.id} />
        ) : (
          active.Component && (
            <active.Component onPlay={() => setPlaying(true)} />
          )
        )}
      </div>
    </div>
  );
}
