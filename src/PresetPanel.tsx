import { useEffect, useState } from "react";

type Values = Record<string, unknown>;
type Presets = Record<string, Values>;
const STORAGE_KEY = "sticker-peel-demo-presets-v1";

function load(): Presets {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}
function persist(p: Presets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function PresetPanel({
  values,
  onLoad,
}: {
  values: Values;
  onLoad: (v: Values) => void;
}) {
  const [presets, setPresets] = useState<Presets>(load);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState("");

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPresets(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const save = (name: string) => {
    const next = { ...presets, [name]: values };
    setPresets(next);
    persist(next);
  };
  const del = (name: string) => {
    const next = { ...presets };
    delete next[name];
    setPresets(next);
    persist(next);
  };
  const rename = (from: string, to: string) => {
    if (!to || to === from || presets[to]) {
      setRenaming(null);
      return;
    }
    const next: Presets = {};
    for (const k of Object.keys(presets)) {
      next[k === from ? to : k] = presets[k];
    }
    setPresets(next);
    persist(next);
    setRenaming(null);
  };

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>presets</div>
      {Object.keys(presets).length === 0 && (
        <div style={emptyStyle}>nothing saved yet</div>
      )}
      {Object.keys(presets).map((name) => (
        <div key={name} style={rowStyle}>
          {renaming === name ? (
            <input
              autoFocus
              value={renameTo}
              onChange={(e) => setRenameTo(e.target.value)}
              onBlur={() => setRenaming(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter") rename(name, renameTo.trim());
                if (e.key === "Escape") setRenaming(null);
              }}
              style={inputStyle}
            />
          ) : (
            <button
              style={nameBtnStyle}
              onClick={() => onLoad(presets[name])}
              title="load"
            >
              {name}
            </button>
          )}
          <button
            style={iconBtnStyle}
            onClick={() => save(name)}
            title="overwrite with current"
          >
            ↓
          </button>
          <button
            style={iconBtnStyle}
            onClick={() => {
              setRenameTo(name);
              setRenaming(name);
            }}
            title="rename"
          >
            ✎
          </button>
          <button
            style={delBtnStyle}
            onClick={() => del(name)}
            title="delete"
          >
            ×
          </button>
        </div>
      ))}
      {adding ? (
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={() => {
            setAdding(false);
            setNewName("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const n = newName.trim();
              if (n && !presets[n]) save(n);
              setAdding(false);
              setNewName("");
            }
            if (e.key === "Escape") {
              setAdding(false);
              setNewName("");
            }
          }}
          placeholder="name…"
          style={{ ...inputStyle, marginTop: 6 }}
        />
      ) : (
        <button
          style={addBtnStyle}
          onClick={() => setAdding(true)}
        >
          + save current
        </button>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: "fixed",
  top: 14,
  left: 14,
  width: 220,
  background: "rgba(255,255,255,0.85)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 14,
  padding: 10,
  fontSize: 12,
  fontFamily: "Inter, system-ui, sans-serif",
  color: "#1a1a1c",
  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
  zIndex: 100,
};
const headerStyle: React.CSSProperties = {
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: 10,
  color: "#74706a",
  marginBottom: 8,
  padding: "0 4px",
};
const emptyStyle: React.CSSProperties = {
  color: "#aaa",
  padding: "6px 4px",
  fontStyle: "italic",
};
const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 2,
  marginBottom: 2,
};
const nameBtnStyle: React.CSSProperties = {
  flex: 1,
  background: "transparent",
  border: "none",
  padding: "5px 6px",
  borderRadius: 6,
  fontSize: 12,
  textAlign: "left",
  cursor: "pointer",
  color: "#1a1a1c",
  fontFamily: "inherit",
};
const iconBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  width: 22,
  height: 22,
  borderRadius: 5,
  cursor: "pointer",
  color: "#74706a",
  fontSize: 13,
};
const delBtnStyle: React.CSSProperties = {
  ...iconBtnStyle,
  fontSize: 16,
};
const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "white",
  border: "1px solid rgba(0,0,0,0.15)",
  borderRadius: 6,
  padding: "4px 6px",
  fontSize: 12,
  fontFamily: "inherit",
  color: "#1a1a1c",
  outline: "none",
};
const addBtnStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 6,
  background: "rgba(0,0,0,0.04)",
  border: "1px dashed rgba(0,0,0,0.15)",
  padding: "6px",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 12,
  color: "#74706a",
  fontFamily: "inherit",
};
