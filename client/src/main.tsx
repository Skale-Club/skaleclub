import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Fallback: hide loader after 5 seconds even if React fails to mount
setTimeout(() => {
  const loader = document.getElementById("initial-loader");
  if (loader) {
    loader.classList.add("loader-fade-out");
    setTimeout(() => loader.remove(), 150);
  }
}, 5000);

createRoot(document.getElementById("root")!).render(<App />);
