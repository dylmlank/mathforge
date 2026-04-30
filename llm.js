// ===== LLM Module =====
const MODELS = [
  'minimax/minimax-m2.5:free',
  'tencent/hy3-preview:free',
  'google/gemma-4-26b-a4b-it:free',
  'inclusionai/ling-2.6-flash:free',
  'inclusionai/ling-2.6-1t:free',
];

const PROMPTS = {
  tutor: `Solve step-by-step, concise, max 4 steps. ALL math in LaTeX: $x^2$ inline, $$x=5$$ block. No tables. If graphable, last line: PLOT:js_expr (use ** for power, Math.sin etc). Example: PLOT:x**2-5*x+3`,

  deepen: `In 2-3 sentences explain WHY this works and connect to related concepts. ALL math in LaTeX $..$ or $$..$$. No tables.`,

  practice: `Output ONLY JSON array, no other text: [{"problem":"...","answer":"..."}] with 3 similar problems. Use LaTeX $..$ in problem strings.`,

  check: 'Reply ONLY: {"correct":true/false,"feedback":"1 sentence"}',
};

async function callLLM(systemPrompt, userPrompt) {
  const key = window.MF.apiKey;
  if (!key) throw new Error('NO_KEY');

  for (const model of MODELS) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.4,
          max_tokens: 700,
        }),
      });
      if (res.status === 429) {
        showToast('Rate limited, trying next model...');
        continue;
      }
      if (!res.ok) continue;
      const data = await res.json();
      if (data.error) continue;
      const content = data.choices?.[0]?.message?.content;
      if (!content) continue;
      return content.trim();
    } catch (e) {
      continue;
    }
  }
  throw new Error('ALL_RATE_LIMITED');
}

function extractJSON(raw) {
  try {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const src = fenced ? fenced[1] : raw;
    const arrMatch = src.match(/\[[\s\S]*\]/);
    if (arrMatch) return JSON.parse(arrMatch[0]);
    const objMatch = src.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
    return JSON.parse(src.trim());
  } catch (e) {
    return null;
  }
}

function renderMarkdown(text) {
  // Remove PLOT lines before rendering
  text = text.replace(/^PLOT:.*$/gm, '');

  // Handle tables → convert to HTML tables
  const lines = text.split('\n');
  let html = '';
  let inTable = false;
  let tableRows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      // Check if separator row
      if (/^\|[\s\-:|]+\|$/.test(line.trim())) continue;
      tableRows.push(line.trim());
      inTable = true;
    } else {
      if (inTable) {
        html += buildTable(tableRows);
        tableRows = [];
        inTable = false;
      }
      html += processLine(line) + '\n';
    }
  }
  if (inTable) html += buildTable(tableRows);

  // Clean up
  html = html
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/<br><\/p>/g, '</p>')
    .replace(/<p><br>/g, '<p>')
    .replace(/^(<br>)+/, '')
    .replace(/(<br>)+$/, '');

  if (!html.startsWith('<')) html = '<p>' + html;
  if (!html.endsWith('>')) html += '</p>';
  // Clean empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

function processLine(line) {
  return line
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/, '<h3>$1</h3>')
    .replace(/^## (.+)$/, '<h2>$1</h2>')
    .replace(/^# (.+)$/, '<h1>$1</h1>')
    .replace(/^\d+\.\s+(.+)$/, '<li class="ol">$1</li>')
    .replace(/^[-*]\s+(.+)$/, '<li>$1</li>');
}

function buildTable(rows) {
  if (rows.length === 0) return '';
  let html = '<table class="md-table"><thead><tr>';
  const headerCells = rows[0].split('|').filter(c => c.trim());
  headerCells.forEach(cell => { html += `<th>${cell.trim()}</th>`; });
  html += '</tr></thead><tbody>';
  for (let i = 1; i < rows.length; i++) {
    html += '<tr>';
    rows[i].split('|').filter(c => c.trim()).forEach(cell => {
      html += `<td>${cell.trim()}</td>`;
    });
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

function extractPlotExpr(text) {
  const match = text.match(/PLOT:\s*(.+)/);
  if (match) return match[1].trim();
  return null;
}
