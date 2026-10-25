import { Fragment, ReactNode } from "react";

/** **bold** inside a line. Everything else is plain text — no HTML is ever injected. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i} className="font-bold text-ink">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>
  );
}

/**
 * Minimal Markdown for policy documents: #/##/### headings, "- " lists, paragraphs
 * (consecutive lines join; a line break inside a paragraph is kept) and **bold**.
 */
export function Markdown({ source, className = "" }: { source: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls = level === 1 ? "mt-6 text-2xl font-black" : level === 2 ? "mt-6 text-lg font-black" : "mt-4 font-bold";
      blocks.push(<p key={i} className={`${cls} text-ink`}>{inline(h[2])}</p>);
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      blocks.push(
        <ul key={i} className="mt-2 list-disc space-y-1 pl-6">
          {items.map((it, j) => <li key={j}>{inline(it)}</li>)}
        </ul>
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3})\s+/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) para.push(lines[i++]);
    blocks.push(
      <p key={i} className="mt-3 leading-relaxed">
        {para.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}
      </p>
    );
  }
  return <div className={`text-sm text-ink-soft ${className}`}>{blocks}</div>;
}
