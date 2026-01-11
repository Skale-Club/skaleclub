import type React from "react";

export function parseInlineMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  // Match **bold**, *italic*, and `code`
  const inlineRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      result.push(<strong key={`${keyPrefix}-b-${match.index}`}>{match[2]}</strong>);
    } else if (match[3]) {
      // *italic*
      result.push(<em key={`${keyPrefix}-i-${match.index}`}>{match[3]}</em>);
    } else if (match[4]) {
      // `code`
      result.push(
        <code key={`${keyPrefix}-c-${match.index}`} className="bg-slate-100 px-1 py-0.5 rounded text-xs font-mono">
          {match[4]}
        </code>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

export function renderMarkdown(text: string, onInternalNav?: (path: string) => void): React.ReactNode[] {
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)|https?:\/\/[^\s]+|\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=-]+/g;

  const lines = text.split("\n");
  const result: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listType: "ul" | "ol" | null = null;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const ListTag = listType === "ol" ? "ol" : "ul";
      result.push(
        <ListTag key={`list-${result.length}`} className={`${listType === "ol" ? "list-decimal" : "list-disc"} ml-4 my-1 space-y-0.5`}>
          {listItems}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };

  lines.forEach((line, lineIdx) => {
    // Check for list items - ONLY match lines that start with list markers
    const ulMatch = line.match(/^[\s]*[-*]\s+(.+)$/);
    const olMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);

    if (ulMatch) {
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      listItems.push(<li key={`li-${lineIdx}`}>{processLine(ulMatch[1], lineIdx)}</li>);
      return;
    }

    if (olMatch) {
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      listItems.push(<li key={`li-${lineIdx}`} value={parseInt(line.match(/^[\s]*(\d+)/)![1])}>{processLine(olMatch[1], lineIdx)}</li>);
      return;
    }

    // Not a list item, flush any pending list
    flushList();

    // Process regular line
    const processedLine = processLine(line, lineIdx);
    result.push(...(Array.isArray(processedLine) ? processedLine : [processedLine]));

    if (lineIdx < lines.length - 1) {
      result.push(<br key={`br-${lineIdx}`} />);
    }
  });

  flushList();
  return result;

  function processLine(line: string, lineIdx: number): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    // Reset regex
    linkRegex.lastIndex = 0;

    while ((match = linkRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        const textBefore = line.slice(lastIndex, match.index);
        parts.push(...parseInlineMarkdown(textBefore, `${lineIdx}-${lastIndex}`));
      }

      const url = match[2] || match[0];
      const label = match[1] || match[0];

      const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        const targetUrl = (() => {
          try {
            return new URL(url, window.location.origin);
          } catch {
            return null;
          }
        })();

        const isInternal =
          !!targetUrl && targetUrl.origin === window.location.origin && targetUrl.pathname.startsWith("/");

        if (isInternal && onInternalNav) {
          onInternalNav(`${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
          return;
        }

        window.open(url, "_blank", "noopener");
      };

      parts.push(
        <a
          key={`${url}-${match.index}`}
          href={url}
          onClick={handleClick}
          rel="noopener noreferrer"
          className="text-blue-600 underline underline-offset-2"
        >
          {label}
        </a>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < line.length) {
      const textAfter = line.slice(lastIndex);
      parts.push(...parseInlineMarkdown(textAfter, `${lineIdx}-${lastIndex}`));
    }

    return parts;
  }
}
