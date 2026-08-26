export type MaterialItem = { section: string; label: string; url: string };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decodeHtml = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

export function parseMaterials(html: string): MaterialItem[] {
  const items: MaterialItem[] = [];
  const sectionRe = /<h2>([\s\S]*?)<\/h2>\s*<ul>([\s\S]*?)<\/ul>/g;
  let sm: RegExpExecArray | null;
  while ((sm = sectionRe.exec(html))) {
    const section = decodeHtml(sm[1].trim());
    const liRe = /<li><a href="([^"]*)"[^>]*>([\s\S]*?)<\/a><\/li>/g;
    let lm: RegExpExecArray | null;
    while ((lm = liRe.exec(sm[2]))) {
      items.push({ section, url: decodeHtml(lm[1]), label: decodeHtml(lm[2]) });
    }
  }
  return items;
}

export function addMaterial(html: string, item: MaterialItem): string {
  const liHtml = `  <li><a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.label)}</a></li>`;
  const sectionHtml = escapeHtml(item.section);
  const sectionRe = new RegExp(`(<h2>${escapeRegex(sectionHtml)}</h2>\\s*<ul>)([\\s\\S]*?)(</ul>)`);
  if (sectionRe.test(html)) {
    return html.replace(sectionRe, (_m, open, body, close) => `${open}${body}${liHtml}\n${close}`);
  }
  const block = `\n<h2>${sectionHtml}</h2>\n<ul>\n${liHtml}\n</ul>\n`;
  return html.includes('</body>') ? html.replace('</body>', `${block}</body>`) : html + block;
}

export function removeMaterial(html: string, url: string, label: string): string {
  const re = new RegExp(`\\s*<li><a href="${escapeRegex(escapeHtml(url))}"[^>]*>${escapeRegex(escapeHtml(label))}</a></li>`);
  return html.replace(re, '');
}
