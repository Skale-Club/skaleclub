import { useState } from "react";
import { ExternalLink, Phone, Mail } from "lucide-react";

export function InlineField({ label, value, onSave, large, linkable, linkHref }: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  large?: boolean;
  linkable?: boolean;
  linkHref?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  function commit() {
    setEditing(false);
    if (local !== value) onSave(local);
  }

  function getLinkIcon() {
    if (!linkHref) return <ExternalLink size={11} />;
    if (linkHref.startsWith("tel:")) return <Phone size={11} />;
    if (linkHref.startsWith("mailto:")) return <Mail size={11} />;
    return <ExternalLink size={11} />;
  }

  const resolvedHref = linkHref ?? (value.startsWith("http") ? value : `https://${value}`);

  return (
    <div>
      {label ? (
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{label}</span>
          {linkable && value && (
            <a
              href={resolvedHref}
              target={linkHref?.startsWith("tel:") || linkHref?.startsWith("mailto:") ? undefined : "_blank"}
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-white/25 hover:text-blue-400 transition-colors"
            >
              {getLinkIcon()}
            </a>
          )}
        </div>
      ) : null}
      {editing ? (
        <input
          autoFocus
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setLocal(value); setEditing(false); }
          }}
          className={`w-full rounded-xl px-2 py-1 text-white outline-none ${large ? "text-xl font-bold" : "text-sm"}`}
          style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.4)" }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`w-full text-left text-white/80 hover:text-white transition-colors block ${large ? "text-xl font-bold leading-tight" : "text-sm truncate"}`}
        >
          {value || <span className="text-white/20 italic">—</span>}
        </button>
      )}
    </div>
  );
}
