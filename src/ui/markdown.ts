// Minimal Markdown → HTML for the bundled user guide (our own trusted file, not user input).
// Supports what docs/UTMUTATO.md uses: headings with GitHub-style ids, paragraphs, nested lists,
// tables, horizontal rules, code fences, **bold**, *italic*, `code`, links, and the <img>/<br> tags.

/** GitHub-like heading id: lower case, letters/digits/spaces/hyphens kept, spaces → hyphens. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s: string, img: (src: string) => string): string {
  // Keep our own <img> and <br> tags, escape everything else.
  const tags: string[] = [];
  let t = s.replace(/<(img|br)\b[^>]*>/gi, (m) => {
    tags.push(m.replace(/src="([^"]+)"/, (_, src) => `src="${img(src)}"`));
    return `\u0000${tags.length - 1}\u0000`;
  });
  t = esc(t);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  t = t.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<i>$2</i>');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) =>
    href.startsWith('#') ? `<a href="${href}" data-anchor="${href.slice(1)}">${label}</a>` : `<a href="${href}" target="_blank" rel="noopener">${label}</a>`,
  );
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => tags[+i]);
}

export function markdownToHtml(md: string, img: (src: string) => string = (s) => s): string {
  const lines = md.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '), img)}</p>`);
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      const n = h[1].length;
      out.push(`<h${n} id="${slug(h[2])}">${inline(h[2], img)}</h${n}>`);
      continue;
    }
    if (/^---+\s*$/.test(line)) {
      flush();
      out.push('<hr>');
      continue;
    }
    if (line.startsWith('```')) {
      flush();
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) code.push(lines[i]);
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^\s*\|/.test(line)) {
      flush();
      const rows: string[][] = [];
      for (; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      i--;
      const body = rows.filter((r) => !r.every((c) => /^:?-+:?$/.test(c)));
      const [head, ...rest] = body;
      out.push(
        `<div class="md-table"><table><thead><tr>${head.map((c) => `<th>${inline(c, img)}</th>`).join('')}</tr></thead><tbody>${rest
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c, img)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`,
      );
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      flush();
      // Nested list by indentation (2–3 spaces per level).
      const stack: { type: string; indent: number }[] = [];
      for (; i < lines.length; i++) {
        const l = lines[i];
        const m = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (!m) {
          // Continuation line of the last item (indented text), or end of the list.
          if (/^\s{2,}\S/.test(l) && stack.length) {
            out.push(' ' + inline(l.trim(), img));
            continue;
          }
          if (l.trim() === '' && /^\s*([-*]|\d+\.)\s+|^\s{2,}\S/.test(lines[i + 1] ?? '')) continue;
          break;
        }
        const indent = m[1].length;
        const type = /\d/.test(m[2]) ? 'ol' : 'ul';
        while (stack.length && indent < stack[stack.length - 1].indent) out.push(`</li></${stack.pop()!.type}>`);
        if (!stack.length || indent > stack[stack.length - 1].indent) {
          out.push(`<${type}>`);
          stack.push({ type, indent });
        } else out.push('</li>');
        out.push(`<li>${inline(m[3], img)}`);
      }
      while (stack.length) out.push(`</li></${stack.pop()!.type}>`);
      i--;
      continue;
    }
    if (line.trim() === '') {
      flush();
      continue;
    }
    // A line that is only an <img> or <br> tag stands on its own.
    if (/^\s*<(img|br)\b[^>]*>\s*$/i.test(line)) {
      flush();
      out.push(inline(line.trim(), img));
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return out.join('\n');
}
