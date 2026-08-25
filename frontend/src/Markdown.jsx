import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

marked.setOptions({ breaks: true });

// 에이전트가 첨부 문서 내용을 읽어 그대로 인용할 수 있으므로(간접 프롬프트 인젝션 경로),
// marked로 HTML 변환 후 반드시 DOMPurify로 살균한다.
export default function Markdown({ text, className }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text || "")), [text]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
