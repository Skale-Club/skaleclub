import { type ReactNode } from "react";

interface LaptopMockupProps {
  children: ReactNode;
}

export function LaptopMockup({ children }: LaptopMockupProps) {
  return (
    <div className="relative w-full select-none">
      {/* Screen overlay — calibrated to the MacBook PNG (730×730) */}
      <div
        className="absolute overflow-hidden bg-gray-900"
        style={{ top: "11%", left: "12%", width: "76%", height: "51%" }}
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
