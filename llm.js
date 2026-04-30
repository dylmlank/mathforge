// ===== LLM Module — Google Gemini =====
const GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
];

const PROMPTS = {
  tutor: `Solve step-by-step, max 4 steps. ALL math in LaTeX $..$ or $$..$$. No tables. Last line if graphable: PLOT: latex_expr (e.g. PLOT: x^2-5x+3)`,

  deepen: `2-3 sentences: why this works, connect to bigger picture. Math in LaTeX $..$.`,

  practice: `ONLY output JSON: [{"problem":"..","answer":".."},{"problem":"..","answer":".."},{"problem":"..","answer":".."}] with LaTeX in strings.`,

  check: '{"correct":true/false,"feedback":"1 sentence"}',
};

async function callLLM(systemPrompt, userPrompt) {
  const key = window.MF.apiKey;
  if (!key) throw new Error('NO_KEY');

  let lastError = '';
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500,
          },
        }),
      });
      if (res.status === 429) {
        showToast('Rate limited, trying next model...');
        continue;
      }
      if (res.status === 400 || res.status === 403) {
        const err = await res.json().catch(() => ({}));
        lastError = err?.error?.message || 'Invalid API key';
        continue;
      }
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }
      const data = await res.json();
      const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        lastError = 'Empty response from model';
        continue;
      }
      return content.trim();
    } catch (e) {
      lastError = e.message;
      continue;
    }
  }
  throw new Error(lastError || 'ALL_RATE_LIMITED');
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
  text = text.replace(/^PLOT:.*$/gm, '');

  const lines = text.split('\n');
  let html = '';
  let inTable = false;
  let tableRows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
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

  html = html
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/<br><\/p>/g, '</p>')
    .replace(/<p><br>/g, '<p>')
    .replace(/^(<br>)+/, '')
    .replace(/(<br>)+$/, '');

  if (!html.startsWith('<')) html = '<p>' + html;
  if (!html.endsWith('>')) html += '</p>';
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
