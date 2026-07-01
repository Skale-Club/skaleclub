import { type ReactNode } from "react";

interface LaptopMockupProps {
  children: ReactNode;
}

export function LaptopMockup({ children }: LaptopMockupProps) {
  return (
    <div className="relative w-full select-none">
      {/* Screen area — positioned to match the SVG inner screen rect (x:72,y:20,w:656,h:420 in 800×530 viewBox) */}
      <div
        className="absolute overflow-hidden rounded-[1%] bg-gray-900"
        style={{ top: "3.8%", left: "9%", width: "82%", height: "79.2%" }}
      >
        {children}
      </div>

      {/* SVG MacBook outline */}
      <svg
        viewBox="0 0 800 530"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
        aria-hidden="true"
      >
        {/* Screen lid */}
        <rect x="60" y="10" width="680" height="440" rx="16" ry="16" fill="#1a1a1a" />
        <rect x="72" y="20" width="656" height="420" rx="10" ry="10" fill="#111" />

        {/* Camera dot */}
        <circle cx="400" cy="32" r="4" fill="#333" />

        {/* Body / base */}
        <rect x="0" y="450" width="800" height="60" rx="6" ry="6" fill="#1a1a1a" />
        {/* Hinge shadow */}
        <rect x="0" y="448" width="800" height="8" fill="#0d0d0d" />
        {/* Trackpad */}
        <rect x="310" y="462" width="180" height="32" rx="8" ry="8" fill="#222" />
        {/* Bottom lip */}
        <rect x="20" y="504" width="760" height="18" rx="5" ry="5" fill="#141414" />
        {/* Notch at hinge center */}
        <rect x="340" y="448" width="120" height="8" rx="4" ry="4" fill="#111" />
      </svg>
    </div>
  );
}
