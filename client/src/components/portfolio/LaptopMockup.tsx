import { type ReactNode } from "react";

interface LaptopMockupProps {
  children: ReactNode;
}

export function LaptopMockup({ children }: LaptopMockupProps) {
  return (
    <div className="relative w-full select-none">
      {/* Screen overlay — calibrated to the transparent screen cutout in laptop-mockup.png
          (730×730; hole measured at x115-607, y164-466px). Kept slightly inset from the
          measured hole edges since the cutout tapers ~1% narrower at the top (perspective),
          so the overlay never bleeds past the opaque bezel at any row. */}
      <div
        className="absolute overflow-hidden bg-gray-900"
        style={{ top: "22.47%", left: "15.75%", width: "67.4%", height: "41.37%" }}
      >
        {children}
      </div>
      <img
        src="/laptop-mockup.png"
        alt=""
        aria-hidden="true"
        className="w-full h-auto relative z-10"
        draggable={false}
      />
    </div>
  );
}
