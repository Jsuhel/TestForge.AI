import React from "react";

/**
 * Minimal markdown renderer shared by the analysis card and the FSD chat:
 * "### " headings, "• " bullets, "- " bullets, **bold** and *italic* spans.
 * Kept deliberately tiny — no markdown dependency, server-safe subset only.
 */

function renderInline(text: string): React.ReactNode[] {
  // Split on **bold** first, then *italic* inside plain segments.
  return text.split(/(\*\*[^*]+\*\*)/g).map((segment, i) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white">
          {segment.slice(2, -2)}
        </strong>
      );
    }
    return (
      <React.Fragment key={i}>
        {segment.split(/(\*[^*]+\*)/g).map((seg, j) =>
          seg.startsWith("*") && seg.endsWith("*") && seg.length > 2 ? (
            <em key={j} className="not-italic font-mono text-[11px] text-blue-400/70">
              {seg.slice(1, -1)}
            </em>
          ) : (
            <React.Fragment key={j}>{seg}</React.Fragment>
          ),
        )}
      </React.Fragment>
    );
  });
}

/** Split a table row like "| a | b |" into its cells. */
function tableRow(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** A markdown table block: every line starts and ends with "|". Separator rows (|---|) dropped. */
function isTable(lines: string[]): boolean {
  return (
    lines.length >= 2 &&
    lines.every((l) => l.trim().startsWith("|") && l.trim().endsWith("|") && l.length > 2)
  );
}

export function RichText({ text }: { text: string }) {
  const blocks = text.split("\n\n");
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n");

        // Markdown table — GLM often answers with these.
        if (isTable(lines)) {
          const rows = lines.map(tableRow).filter((cells) => !cells.every((c) => /^:?-{2,}:?$/.test(c)));
          const [head, ...body] = rows;
          return (
            <div key={i} className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr>
                    {head.map((cell, j) => (
                      <th
                        key={j}
                        className="border-b border-slate-700/70 px-3 py-2 font-semibold text-white whitespace-nowrap"
                      >
                        {renderInline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, r) => (
                    <tr key={r} className="align-top">
                      {row.map((cell, j) => (
                        <td key={j} className="border-b border-slate-800/60 px-3 py-2 text-slate-300">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.startsWith("### ")) {
          return (
            <h4
              key={i}
              className="font-display text-sm font-semibold text-white mt-6 mb-2 pb-1.5 border-b border-slate-800/80"
            >
              {renderInline(block.slice(4))}
            </h4>
          );
        }
        const isBulletList =
          lines.length > 0 && lines.every((l) => l.startsWith("• ") || l.startsWith("- "));
        if (isBulletList) {
          return (
            <ul key={i} className="my-2 space-y-1.5">
              {lines.map((line, j) => (
                <li key={j} className="flex items-start gap-2.5">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400/80" />
                  <span className="leading-relaxed">{renderInline(line.slice(2))}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="my-2 leading-relaxed">
            {renderInline(block)}
          </p>
        );
      })}
    </>
  );
}
