// 목업 원본이 만들어내는 "color:#fff;padding:3px 9px;..." 형태의 CSS 문자열을
// React style 객체로 변환. 원본 스타일 생성 함수를 그대로 재사용하기 위한 어댑터.
export function cssStr(str) {
  const obj = {};
  if (!str) return obj;
  str.split(";").forEach((decl) => {
    const idx = decl.indexOf(":");
    if (idx === -1) return;
    const prop = decl.slice(0, idx).trim();
    const val = decl.slice(idx + 1).trim();
    if (!prop || !val) return;
    const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    obj[camel] = val;
  });
  return obj;
}
