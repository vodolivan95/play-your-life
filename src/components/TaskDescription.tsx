import type { ReactNode } from "react";
import { safeWebUrl } from "../taskDetails";

function inline(value: string): ReactNode[] {
  return value
    .split(/(!?\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g)
    .map((part, key) => {
      const match = /^(!?)\[([^\]]*)\]\(([^)]+)\)$/.exec(part);
      const url = match && safeWebUrl(match[3]);
      if (match && url)
        return match[1] ? (
          <img
            key={key}
            src={url}
            alt={match[2]}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <a key={key} href={url} target="_blank" rel="noopener noreferrer">
            {match[2]}
          </a>
        );
      if (/^\*\*[^*]+\*\*$/.test(part))
        return <strong key={key}>{part.slice(2, -2)}</strong>;
      if (/^\*[^*]+\*$/.test(part))
        return <em key={key}>{part.slice(1, -1)}</em>;
      if (/^`[^`]+`$/.test(part))
        return <code key={key}>{part.slice(1, -1)}</code>;
      return part;
    });
}
/** Small Markdown subset stored as the existing plain-text notes. Never inject HTML. */
export default function TaskDescription({ value }: { value: string }) {
  const blocks: ReactNode[] = [];
  const lines = value.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const list = /^(?:[-*] |\d+\. )/.test(line);
    if (list) {
      const ordered = /^\d+\. /.test(line),
        items: ReactNode[] = [];
      while (
        i < lines.length &&
        (ordered ? /^\d+\. / : /^[-*] /).test(lines[i])
      ) {
        items.push(
          <li key={i}>{inline(lines[i].replace(/^(?:[-*] |\d+\. )/, ""))}</li>,
        );
        i++;
      }
      i--;
      blocks.push(
        ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>,
      );
    } else if (/^#{1,6} /.test(line))
      blocks.push(<h4 key={i}>{inline(line.replace(/^#{1,6} /, ""))}</h4>);
    else blocks.push(<p key={i}>{inline(line) || "\u00a0"}</p>);
  }
  return <div className="task-markdown">{blocks}</div>;
}
