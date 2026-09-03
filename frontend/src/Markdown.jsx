import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ breaks: true });

// 보고서 끝의 ```json 블록은 서버 저장용이라 사람에게 보여주지 않는다.
// 닫히지 않은 펜스(스트리밍 중)는 매칭되지 않아 그대로 보이다가 닫히는 순간 사라진다.
// 닫는 ``` 앞 개행은 선택 — report.py 의 _FENCE 와 같은 조건이어야 한다. 더 엄격하면
// 한 줄짜리 블록이 서버에서는 추출되고 화면에서는 안 지워져 raw json 이 그대로 새어 나온다.
const TRAILING_JSON = /```json\s*\n[\s\S]*?\n?\s*```\s*$/;
export function stripReportJson(text) {
  return (text || "").replace(TRAILING_JSON, "").trimEnd();
}

// 에이전트가 첨부 문서 내용을 읽어 그대로 인용할 수 있으므로(간접 프롬프트 인젝션 경로),
// marked로 HTML 변환 후 반드시 DOMPurify로 살균한다.
export default function Markdown({ text, className }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(stripReportJson(text))), [text]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
