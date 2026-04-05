"use strict";

/**
 * markdown.js — minimal, XSS-safe Markdown → HTML renderer.
 *
 * Supported syntax:
 *   # Heading 1 / ## Heading 2 / ### Heading 3
 *   **bold**  *italic*  `inline code`
 *   ``` fenced code blocks ```
 *   - unordered list items (- or *)
 *   --- horizontal rule
 *   Blank lines separate paragraphs.
 *
 * Security: HTML entities are escaped BEFORE markdown patterns are
 * applied, so only the renderer's own trusted tags can appear in output.
 */

function renderMarkdown(raw) {
  if (!raw) return "<p class=\"md-empty\">Nothing to preview.</p>";

  // Step 1: escape HTML entities to prevent XSS
  const escaped = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = escaped.split("\n");
  const out   = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (/^```/.test(line.trim())) {
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i++;
      }
      out.push("<pre><code>" + codeLines.join("\n") + "</code></pre>");
      i++; // consume closing ```
      continue;
    }

    // Horizontal rule (--- or ***)
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      out.push("<hr>");
      i++;
      continue;
    }

    // ATX headings
    const h3 = line.match(/^### (.+)$/);
    if (h3) { out.push("<h3>" + inlineMarkdown(h3[1]) + "</h3>"); i++; continue; }
    const h2 = line.match(/^## (.+)$/);
    if (h2) { out.push("<h2>" + inlineMarkdown(h2[1]) + "</h2>"); i++; continue; }
    const h1 = line.match(/^# (.+)$/);
    if (h1) { out.push("<h1>" + inlineMarkdown(h1[1]) + "</h1>"); i++; continue; }

    // Unordered list — collect consecutive list items
    if (/^[*-] /.test(line)) {
      out.push("<ul>");
      while (i < lines.length && /^[*-] /.test(lines[i])) {
        out.push("<li>" + inlineMarkdown(lines[i].replace(/^[*-] /, "")) + "</li>");
        i++;
      }
      out.push("</ul>");
      continue;
    }

    // Blank line — paragraph break
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Regular paragraph — collect consecutive non-special lines
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3} |[*-] |```)/.test(lines[i]) &&
      !/^(-{3,}|\*{3,})$/.test(lines[i].trim())
    ) {
      para.push(inlineMarkdown(lines[i]));
      i++;
    }
    if (para.length) {
      out.push("<p>" + para.join("<br>") + "</p>");
    }
  }

  return out.join("\n") || "<p class=\"md-empty\">Nothing to preview.</p>";
}

function inlineMarkdown(text) {
  return text
    // Inline code — process before bold/italic so * inside code is safe
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Bold **text**
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // Italic *text*
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
}
