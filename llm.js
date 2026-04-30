// ===== LLM Module =====
const MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-4-maverick:free',
  'google/gemma-3-27b-it:free',
  'qwen/qwen3-235b-a22b:free',
];

const SYSTEM_PROMPTS = {
  explain: 'Math tutor. Give concise explanation with a worked example. Use $...$ inline and $$...$$ block LaTeX. Be direct.',
  generate: 'Generate ONE math problem. Output JSON: {"problem":"...","answer":"...","steps":["..."],"plot_data":null}. Use LaTeX in strings.',
  check: 'Grade this math answer. Reply JSON: {"correct":bool,"feedback":"..."}. Be encouraging, use LaTeX.',
  hint: 'Give one helpful hint without revealing the answer. Use LaTeX. Max 2 sentences.',
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
          'HTTP-Referer': 'http://localhost:8080',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });
      if (res.status === 429) {
        showToast('Rate limited, trying next model...');
        continue;
      }
      if (!res.ok) continue;
      const data = await res.json();
      if (data.error) continue;
      return data.choices[0].message.content.trim();
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
    // Try to find JSON object in the string
    const jsonMatch = src.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(src.trim());
  } catch (e) {
    return null;
  }
}

function renderMarkdown(text) {
  // Simple markdown → HTML (bold, italic, headers, lists, code blocks)
  let html = text
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/((?:<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  // Wrap in paragraph if not already
  if (!html.startsWith('<')) html = '<p>' + html + '</p>';
  return html;
}
