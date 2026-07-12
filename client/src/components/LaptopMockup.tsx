import { type ReactNode } from "react";

interface LaptopMockupProps {
  children: ReactNode;
}

export function LaptopMockup({ children }: LaptopMockupProps) {
  return (
    <div className="relative w-full select-none overflow-hidden" style={{ aspectRatio: "690 / 446" }}>
      {/* The source PNG has transparent padding around the visible laptop.
          Crop the wrapper to the measured opaque bounds so the modal layout
          uses the actual computer size, not the padded image box. */}
      <div
        className="absolute overflow-hidden bg-gray-900"
        style={{ top: "4.93%", left: "13.77%", width: "71.3%", height: "67.71%" }}
      >
        {children}
      </div>
      <img
        src="/laptop-mockup.png"
        alt=""
        aria-hidden="true"
        className="absolute z-10 max-w-none h-auto"
        style={{ width: "105.8%", left: "-2.9%", top: "-31.84%" }}
        draggable={false}
      />
    </div>
  );
}
