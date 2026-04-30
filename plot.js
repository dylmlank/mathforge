// ===== Plot Module =====
const PLOT_LAYOUT = {
  paper_bgcolor: '#12121a',
  plot_bgcolor: '#12121a',
  font: { color: '#e4e4ef', family: 'Inter', size: 12 },
  xaxis: { gridcolor: '#2a2a3e', zerolinecolor: '#8b5cf6', zerolinewidth: 1 },
  yaxis: { gridcolor: '#2a2a3e', zerolinecolor: '#8b5cf6', zerolinewidth: 1 },
  margin: { l: 45, r: 20, t: 35, b: 40 },
  showlegend: false,
};

const PLOT_CONFIG = { responsive: true, displayModeBar: false };

// Clean LLM expression into evaluable JS
function cleanExpr(raw) {
  let e = raw.trim();
  // Remove trailing punctuation/periods the LLM might add
  e = e.replace(/[.,;:!?]+$/, '');
  // Remove any remaining LaTeX commands
  e = e.replace(/\\left|\\right/g, '');
  e = e.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '(($1)/($2))');
  e = e.replace(/\\sqrt\{([^}]+)\}/g, 'Math.sqrt($1)');
  e = e.replace(/\\(?:cdot|times)/g, '*');
  e = e.replace(/\\pi/g, 'Math.PI');
  e = e.replace(/\\e/g, 'Math.E');
  e = e.replace(/\\ln/g, 'Math.log');
  e = e.replace(/\\log/g, 'Math.log');
  e = e.replace(/\\sin/g, 'Math.sin');
  e = e.replace(/\\cos/g, 'Math.cos');
  e = e.replace(/\\tan/g, 'Math.tan');
  e = e.replace(/\\abs/g, 'Math.abs');
  e = e.replace(/\\exp/g, 'Math.exp');
  e = e.replace(/\\/g, ''); // remove any remaining backslashes
  e = e.replace(/\{/g, '(').replace(/\}/g, ')');
  // Handle ^ power
  e = e.replace(/\^/g, '**');
  // Handle implicit multiplication: 2x → 2*x, 3( → 3*(
  e = e.replace(/(\d)([a-zA-Z(])/g, '$1*$2');
  e = e.replace(/([a-zA-Z)])(\d)/g, '$1*$2');
  e = e.replace(/\)\(/g, ')*(');
  // Named functions (without Math. prefix already)
  e = e.replace(/(?<!Math\.)(?<![\w.])\b(sin|cos|tan|sqrt|log|ln|exp|abs)\b/g, (m) => {
    if (m === 'ln') return 'Math.log';
    return 'Math.' + m;
  });
  // pi → Math.PI
  e = e.replace(/(?<!Math\.)\bpi\b/g, 'Math.PI');
  e = e.replace(/(?<!Math\.)\be\b(?!\*\*|x|[a-df-z])/g, 'Math.E');
  return e;
}

function plotFunction(expr, container) {
  container = container || document.getElementById('plot-container');
  const jsExpr = cleanExpr(expr);
  const x = [], y = [];
  let fn;
  try {
    fn = new Function('x', `"use strict"; return ${jsExpr}`);
  } catch (e) {
    console.warn('Plot parse error:', jsExpr, e);
    return;
  }
  for (let i = -10; i <= 10; i += 0.05) {
    x.push(Math.round(i * 100) / 100);
    try {
      const val = fn(i);
      y.push(isFinite(val) && Math.abs(val) < 1e6 ? val : null);
    } catch { y.push(null); }
  }
  // Auto-range Y
  const validY = y.filter(v => v !== null);
  const yMin = Math.min(...validY);
  const yMax = Math.max(...validY);
  const pad = (yMax - yMin) * 0.1 || 2;

  Plotly.newPlot(container, [{
    x, y, type: 'scatter', mode: 'lines',
    line: { color: '#8b5cf6', width: 2.5, shape: 'spline' },
  }], {
    ...PLOT_LAYOUT,
    yaxis: { ...PLOT_LAYOUT.yaxis, range: [yMin - pad, yMax + pad] },
  }, PLOT_CONFIG);
}
