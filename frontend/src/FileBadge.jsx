import { fileTypeInfo } from "./fileType.js";

const styles = {
  chip: { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid transparent", borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 500 },
  typeTag: { fontSize: 9.5, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "rgba(255,255,255,0.6)" },
};

export default function FileBadge({ name, size, onRemove }) {
  const t = fileTypeInfo(name);
  return (
    <div style={{ ...styles.chip, background: t.bg, color: t.color, borderColor: t.bg }}>
      <span style={styles.typeTag}>{t.label}</span>
      <span style={{ color: "#3A4656" }}>{name}</span>
      {size && <span style={{ color: "#8A94A3" }}>{size}</span>}
      {onRemove && (
        <button
          onClick={onRemove}
          style={{ border: "none", background: "none", cursor: "pointer", color: t.color, fontSize: 13, lineHeight: 1, padding: 0, marginLeft: 2 }}
        >
          ×
        </button>
      )}
    </div>
  );
}
