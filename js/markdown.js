export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderMarkdown(raw) {
  const text = String(raw || "").replace(/\r\n/g, "\n");
  const codeBlocks = [];
  const displayMath = [];
  const inlineMath = [];

  let safeSource = text.replace(/```([a-zA-Z0-9_+#-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang: lang || "code", code: code.replace(/\n$/, "") });
    return `\u0000CODEBLOCK_${idx}\u0000`;
  });

  safeSource = safeSource.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
    const idx = displayMath.length;
    displayMath.push(expr.trim());
    return `\n\u0000MATHDISPLAY_${idx}\u0000\n`;
  });

  safeSource = safeSource.replace(/(^|[^\\])\$([^\s$][^$\n]*?[^\s\\$]|[^\s\\$])\$(?!\d)/g, (_, prefix, expr) => {
    const idx = inlineMath.length;
    inlineMath.push(expr);
    return `${prefix}\u0000MATHINLINE_${idx}\u0000`;
  });

  const lines = safeSource.split("\n");
  const htmlParts = [];
  let paragraphLines = [];
  let listType = null;

  function flushParagraph() {
    if (!paragraphLines.length) return;
    const joined = paragraphLines.map(formatInline).join("<br>");
    htmlParts.push(`<p>${joined}</p>`);
    paragraphLines = [];
  }

  function flushList() {
    if (!listType) return;
    htmlParts.push(listType === "ul" ? "</ul>" : "</ol>");
    listType = null;
  }

  function formatInline(line) {
    let safe = escapeHtml(line);
    safe = safe.replace(/`([^`]+)`/g, "<code>$1</code>");
    safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    safe = safe.replace(/\u0000MATHINLINE_(\d+)\u0000/g, (_, idx) => {
      return `<span class="math-inline">$${escapeHtml(inlineMath[Number(idx)])}$</span>`;
    });
    return safe;
  }

  for (const line of lines) {
    const cbMatch = line.trim().match(/^\u0000CODEBLOCK_(\d+)\u0000$/);
    if (cbMatch) {
      flushParagraph();
      flushList();
      const block = codeBlocks[Number(cbMatch[1])];
      htmlParts.push(
        `<div class="code-wrapper" data-code-idx="${cbMatch[1]}">` +
          `<div class="code-header"><span>${escapeHtml(block.lang)}</span>` +
          `<button class="copy-code-btn" type="button">Copy</button></div>` +
          `<pre><code>${escapeHtml(block.code)}</code></pre>` +
        `</div>`
      );
      continue;
    }

    const dmMatch = line.trim().match(/^\u0000MATHDISPLAY_(\d+)\u0000$/);
    if (dmMatch) {
      flushParagraph();
      flushList();
      const expr = displayMath[Number(dmMatch[1])];
      htmlParts.push(`<div class="math-display">$$${escapeHtml(expr)}$$</div>`);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const hMatch = line.match(/^#{1,4}\s+(.*)$/);
    if (hMatch) {
      flushParagraph();
      flushList();
      htmlParts.push(`<h3>${formatInline(hMatch[1])}</h3>`);
      continue;
    }

    const bqMatch = line.match(/^>\s+(.*)$/);
    if (bqMatch) {
      flushParagraph();
      flushList();
      htmlParts.push(`<blockquote>${formatInline(bqMatch[1])}</blockquote>`);
      continue;
    }

    const ulMatch = line.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      if (listType !== "ul") {
        flushList();
        htmlParts.push("<ul>");
        listType = "ul";
      }
      htmlParts.push(`<li>${formatInline(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      if (listType !== "ol") {
        flushList();
        htmlParts.push("<ol>");
        listType = "ol";
      }
      htmlParts.push(`<li>${formatInline(olMatch[1])}</li>`);
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  let output = htmlParts.join("");
  output = output.replace(/\u0000CODEBLOCK_(\d+)\u0000/g, (_, idx) => {
    const block = codeBlocks[Number(idx)];
    return (
      `<div class="code-wrapper" data-code-idx="${idx}">` +
        `<div class="code-header"><span>${escapeHtml(block.lang)}</span>` +
        `<button class="copy-code-btn" type="button">Copy</button></div>` +
        `<pre><code>${escapeHtml(block.code)}</code></pre>` +
      `</div>`
    );
  });
  output = output.replace(/\u0000MATHDISPLAY_(\d+)\u0000/g, (_, idx) => {
    return `<div class="math-display">$$${escapeHtml(displayMath[Number(idx)])}$$</div>`;
  });

  return { html: output, codeBlocks };
}

export function typesetMath(containerEl) {
  if (!window.renderMathInElement || !containerEl) return;
  try {
    window.renderMathInElement(containerEl, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false }
      ],
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      throwOnError: false
    });
  } catch {}
}
