import type { ReactNode } from "react";

const INLINE_MARKDOWN =
  /(\*\*.+?\*\*|__.+?__|`[^`]+`|\[[^\]]+\]\([^\s)]+\)|\*[^*\n]+\*|_[^_\n]+_)/g;

function inline(text: string): ReactNode[] {
  return text
    .split(INLINE_MARKDOWN)
    .filter(Boolean)
    .map((part, index) => {
      if (
        (part.startsWith("**") && part.endsWith("**")) ||
        (part.startsWith("__") && part.endsWith("__"))
      ) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={index}
            className="rounded bg-black/5 px-1 py-0.5 text-[0.92em]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      const link = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
      if (link) {
        const href = /^(https?:|mailto:)/i.test(link[2]) ? link[2] : "#";
        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {link[1]}
          </a>
        );
      }
      if (
        (part.startsWith("*") && part.endsWith("*")) ||
        (part.startsWith("_") && part.endsWith("_"))
      ) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      return part;
    });
}

function isBlockStart(line: string) {
  return /^(#{1,3}\s+|>\s+|[-*+]\s+|\d+[.)]\s+)/.test(line);
}

export default function MarkdownMessage({ children }: { children: string }) {
  const lines = children.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];

  for (let i = 0; i < lines.length; ) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      blocks.push(
        <p key={i} className="font-bold">
          {inline(heading[2])}
        </p>,
      );
      i++;
      continue;
    }

    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    const unordered = line.match(/^[-*+]\s+(.+)$/);
    if (ordered || unordered) {
      const orderedList = Boolean(ordered);
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const match = lines[i]
          .trim()
          .match(orderedList ? /^\d+[.)]\s+(.+)$/ : /^[-*+]\s+(.+)$/);
        if (!match) break;
        items.push(<li key={i}>{inline(match[1])}</li>);
        i++;
      }
      const className = "space-y-1 pl-5 marker:font-semibold";
      blocks.push(
        orderedList ? (
          <ol key={`list-${i}`} className={`${className} list-decimal`}>
            {items}
          </ol>
        ) : (
          <ul key={`list-${i}`} className={`${className} list-disc`}>
            {items}
          </ul>
        ),
      );
      continue;
    }

    if (line.startsWith("> ")) {
      blocks.push(
        <blockquote key={i} className="border-l-2 border-black/20 pl-3 italic">
          {inline(line.slice(2))}
        </blockquote>,
      );
      i++;
      continue;
    }

    const paragraph = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isBlockStart(lines[i].trim())
    ) {
      paragraph.push(lines[i].trim());
      i++;
    }
    blocks.push(<p key={i}>{inline(paragraph.join(" "))}</p>);
  }

  return <div className="space-y-2 leading-relaxed">{blocks}</div>;
}
