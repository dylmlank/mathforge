// ===== LLM Module =====
const MODELS = [
  'minimax/minimax-m2.5:free',
  'tencent/hy3-preview:free',
  'google/gemma-4-26b-a4b-it:free',
  'inclusionai/ling-2.6-flash:free',
  'inclusionai/ling-2.6-1t:free',
];

const PROMPTS = {
  tutor: 'Math tutor. Walk through this step-by-step. Use $...$ inline, $$...$$ block LaTeX. If there is a function to graph include PLOT: expression on its own line (e.g. PLOT: x^2-5*x+3). Be thorough but clear.',
  deepen: 'Explain WHY this math works. Connect to related concepts. What is the bigger picture? Use LaTeX. Be insightful, not repetitive.',
  practice: 'Generate exactly 3 practice problems similar to what the student is working on. Output JSON array: [{"problem":"...","answer":"..."}]. Use LaTeX in problem strings. Vary difficulty slightly.',
  check: 'Grade this answer. Reply JSON: {"correct":bool,"feedback":"short explanation"}. Use LaTeX if needed.',
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
          temperature: 0.7,
          max_tokens: 2000,
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
  let html = text
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/((?:<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  if (!html.startsWith('<')) html = '<p>' + html + '</p>';
  // Remove PLOT: lines from display
  html = html.replace(/<br>PLOT:.*?(?:<br>|<\/p>)/g, '');
  html = html.replace(/PLOT:.*?(?:<br>|<\/p>)/g, '');
  return html;
}

function extractPlotExpr(text) {
  const match = text.match(/PLOT:\s*(.+)/);
  if (match) return match[1].trim();
  return null;
}
