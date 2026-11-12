// ── Lightweight Markdown renderer (no external lib needed) ──────────────────
export function renderMarkdown(text: string): string {
  if (!text) return '';

  // Escape HTML first to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Process block elements line by line
  const lines = html.split('\n');
  const result: string[] = [];
  let inOrderedList = false;
  let inUnorderedList = false;

  const closeListsIfOpen = () => {
    if (inOrderedList)   { result.push('</ol>');  inOrderedList = false; }
    if (inUnorderedList) { result.push('</ul>');  inUnorderedList = false; }
  };

  for (let line of lines) {
    // Numbered list: lines starting with "1.", "2.", etc.
    const olMatch = line.match(/^(\d+)\.\s+(.+)/);
    // Bullet list: lines starting with -, *, or •
    const ulMatch = line.match(/^[-*•]\s+(.+)/);

    if (olMatch) {
      if (inUnorderedList) { result.push('</ul>'); inUnorderedList = false; }
      if (!inOrderedList)  { result.push('<ol class="list-decimal list-inside space-y-1 my-2 pl-1">'); inOrderedList = true; }
      result.push(`<li>${inlineMarkdown(olMatch[2])}</li>`);
    } else if (ulMatch) {
      if (inOrderedList)   { result.push('</ol>'); inOrderedList = false; }
      if (!inUnorderedList){ result.push('<ul class="list-disc list-inside space-y-1 my-2 pl-1">'); inUnorderedList = true; }
      result.push(`<li>${inlineMarkdown(ulMatch[1])}</li>`);
    } else {
      closeListsIfOpen();
      if (line.trim() === '') {
        result.push('<br/>');
      } else {
        result.push(`<p class="mb-1">${inlineMarkdown(line)}</p>`);
      }
    }
  }
  closeListsIfOpen();

  return result.join('\n');
}

// Process inline elements: **bold**, *italic*, `code`
function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 text-gray-700 px-1 rounded text-sm font-mono">$1</code>');
}
// ────────────────────────────────────────────────────────────────────────────
