const TYPES = {
  pdf: { label: "PDF", color: "#0E7C86", bg: "#E1F3F4" },
  doc: { label: "Word", color: "#2A56A8", bg: "#E7EEF6" },
  docx: { label: "Word", color: "#2A56A8", bg: "#E7EEF6" },
  xls: { label: "Excel", color: "#0F7A55", bg: "#E6F4EE" },
  xlsx: { label: "Excel", color: "#0F7A55", bg: "#E6F4EE" },
  ppt: { label: "PPT", color: "#9A6B10", bg: "#FaF0D8" },
  pptx: { label: "PPT", color: "#9A6B10", bg: "#FaF0D8" },
  hwp: { label: "HWP", color: "#3B5A86", bg: "#E9EEF6" },
  hwpx: { label: "HWP", color: "#3B5A86", bg: "#E9EEF6" },
  txt: { label: "TXT", color: "#5A6473", bg: "#EEF1F4" },
  md: { label: "MD", color: "#5A6473", bg: "#EEF1F4" },
  png: { label: "이미지", color: "#7A4FA0", bg: "#F0E9F7" },
  jpg: { label: "이미지", color: "#7A4FA0", bg: "#F0E9F7" },
  jpeg: { label: "이미지", color: "#7A4FA0", bg: "#F0E9F7" },
};
const DEFAULT_TYPE = { label: "파일", color: "#5A6473", bg: "#EEF1F4" };

export function fileTypeInfo(filename) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  return TYPES[ext] || DEFAULT_TYPE;
}
