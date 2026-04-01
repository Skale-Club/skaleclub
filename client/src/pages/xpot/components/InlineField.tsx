import { useState } from "react";

export function InlineField({ label, value, onSave, large }: {
  label: string;
  value: string;
  onSave: (v: string) => void;
  large?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  function commit() {
    setEditing(false);
    if (local !== value) onSave(local);
  }

  return (
    <div>
      {label ? <div className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-0.5">{label}</div> : null}
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
          className={`w-full rounded-md border border-primary/40 bg-background px-2 py-1 text-foreground outline-none focus:border-primary ${large ? "text-xl font-bold" : "text-sm"}`}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`w-full text-left text-foreground hover:text-primary transition-colors block ${large ? "text-xl font-bold leading-tight" : "text-sm truncate"}`}
        >
          {value || <span className="text-muted-foreground/40 italic">—</span>}
        </button>
      )}
    </div>
  );
}
