// ===== Plot Module =====
const PLOT_LAYOUT = {
  paper_bgcolor: '#12121a',
  plot_bgcolor: '#12121a',
  font: { color: '#e4e4ef', family: 'Inter' },
  xaxis: { gridcolor: '#2a2a3e', zerolinecolor: '#8b5cf6', zerolinewidth: 1 },
  yaxis: { gridcolor: '#2a2a3e', zerolinecolor: '#8b5cf6', zerolinewidth: 1 },
  margin: { l: 45, r: 20, t: 30, b: 40 },
  showlegend: false,
};

const PLOT_CONFIG = { responsive: true, displayModeBar: false };

function plotFunction(expr, container) {
  container = container || document.getElementById('plot-container');
  const x = [], y = [];
  const safeExpr = expr.replace(/\^/g, '**');
  for (let i = -10; i <= 10; i += 0.05) {
    x.push(i);
    try {
      const val = new Function('x', `return ${safeExpr}`)(i);
      y.push(isFinite(val) ? val : null);
    } catch { y.push(null); }
  }
  Plotly.newPlot(container, [{
    x, y, type: 'scatter', mode: 'lines',
    line: { color: '#8b5cf6', width: 2.5 },
  }], { ...PLOT_LAYOUT, title: { text: `y = ${expr}`, font: { size: 13 } } }, PLOT_CONFIG);
}

function plotDerivative(expr, atX, container) {
  container = container || document.getElementById('plot-container');
  const safeExpr = expr.replace(/\^/g, '**');
  const f = new Function('x', `return ${safeExpr}`);
  const x = [], y = [];
  for (let i = -10; i <= 10; i += 0.05) {
    x.push(i);
    try { const v = f(i); y.push(isFinite(v) ? v : null); } catch { y.push(null); }
  }
  // Tangent line at point
  const h = 0.0001;
  const slope = (f(atX + h) - f(atX - h)) / (2 * h);
  const yAtX = f(atX);
  const tx = [], ty = [];
  for (let i = atX - 3; i <= atX + 3; i += 0.1) {
    tx.push(i);
    ty.push(yAtX + slope * (i - atX));
  }
  Plotly.newPlot(container, [
    { x, y, type: 'scatter', mode: 'lines', line: { color: '#8b5cf6', width: 2.5 }, name: 'f(x)' },
    { x: tx, y: ty, type: 'scatter', mode: 'lines', line: { color: '#ec4899', width: 2, dash: 'dash' }, name: 'tangent' },
    { x: [atX], y: [yAtX], type: 'scatter', mode: 'markers', marker: { color: '#f97316', size: 8 } },
  ], { ...PLOT_LAYOUT, showlegend: true, title: { text: `Tangent at x=${atX}`, font: { size: 13 } } }, PLOT_CONFIG);
}

function plotDistribution(type, params, container) {
  container = container || document.getElementById('plot-container');
  const x = [], y = [];
  if (type === 'normal') {
    const [mu, sigma] = params || [0, 1];
    for (let i = mu - 4 * sigma; i <= mu + 4 * sigma; i += 0.05) {
      x.push(i);
      y.push((1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((i - mu) / sigma) ** 2));
    }
    Plotly.newPlot(container, [{
      x, y, type: 'scatter', mode: 'lines', fill: 'tozeroy',
      line: { color: '#06b6d4', width: 2 }, fillcolor: 'rgba(6,182,212,0.15)',
    }], { ...PLOT_LAYOUT, title: { text: `Normal(${mu}, ${sigma})`, font: { size: 13 } } }, PLOT_CONFIG);
  } else if (type === 'binomial') {
    const [n, p] = params || [10, 0.5];
    for (let k = 0; k <= n; k++) {
      x.push(k);
      y.push(binomialPMF(n, k, p));
    }
    Plotly.newPlot(container, [{
      x, y, type: 'bar',
      marker: { color: '#f97316' },
    }], { ...PLOT_LAYOUT, title: { text: `Binomial(${n}, ${p})`, font: { size: 13 } } }, PLOT_CONFIG);
  } else if (type === 'poisson') {
    const lambda = (params && params[0]) || 5;
    for (let k = 0; k <= lambda * 3; k++) {
      x.push(k);
      y.push((Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k));
    }
    Plotly.newPlot(container, [{
      x, y, type: 'bar',
      marker: { color: '#ec4899' },
    }], { ...PLOT_LAYOUT, title: { text: `Poisson(${lambda})`, font: { size: 13 } } }, PLOT_CONFIG);
  }
}

function plotVectors2D(vectors, container) {
  container = container || document.getElementById('plot-container');
  const colors = ['#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
  const traces = vectors.map((v, i) => ({
    x: [0, v[0]], y: [0, v[1]], type: 'scatter', mode: 'lines+markers',
    line: { color: colors[i % colors.length], width: 2.5 },
    marker: { size: [0, 8], symbol: ['circle', 'triangle-up'] },
    name: `v${i + 1} = (${v[0]}, ${v[1]})`,
  }));
  const maxVal = Math.max(...vectors.flat().map(Math.abs), 5);
  Plotly.newPlot(container, traces, {
    ...PLOT_LAYOUT, showlegend: true,
    xaxis: { ...PLOT_LAYOUT.xaxis, range: [-maxVal - 1, maxVal + 1] },
    yaxis: { ...PLOT_LAYOUT.yaxis, range: [-maxVal - 1, maxVal + 1], scaleanchor: 'x' },
  }, PLOT_CONFIG);
}

function plotMatrixTransform(matrix, container) {
  container = container || document.getElementById('plot-container');
  // Show unit square before and after transformation
  const square = [[0,0],[1,0],[1,1],[0,1],[0,0]];
  const transformed = square.map(([x,y]) => [
    matrix[0][0]*x + matrix[0][1]*y,
    matrix[1][0]*x + matrix[1][1]*y,
  ]);
  Plotly.newPlot(container, [
    { x: square.map(p=>p[0]), y: square.map(p=>p[1]), type: 'scatter', mode: 'lines',
      line: { color: '#8b5cf6', width: 2, dash: 'dash' }, name: 'Original' },
    { x: transformed.map(p=>p[0]), y: transformed.map(p=>p[1]), type: 'scatter', mode: 'lines',
      line: { color: '#ec4899', width: 2.5 }, name: 'Transformed', fill: 'toself', fillcolor: 'rgba(236,72,153,0.1)' },
  ], {
    ...PLOT_LAYOUT, showlegend: true,
    xaxis: { ...PLOT_LAYOUT.xaxis, range: [-3, 3] },
    yaxis: { ...PLOT_LAYOUT.yaxis, range: [-3, 3], scaleanchor: 'x' },
    title: { text: `[[${matrix[0]}],[${matrix[1]}]]`, font: { size: 13 } },
  }, PLOT_CONFIG);
}

function plotHistogram(data, container) {
  container = container || document.getElementById('plot-container');
  Plotly.newPlot(container, [{
    x: data, type: 'histogram',
    marker: { color: 'rgba(139,92,246,0.7)', line: { color: '#8b5cf6', width: 1 } },
  }], { ...PLOT_LAYOUT, title: { text: 'Distribution', font: { size: 13 } } }, PLOT_CONFIG);
}

// Helpers
function factorial(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
function binomialPMF(n, k, p) {
  const coeff = factorial(n) / (factorial(k) * factorial(n - k));
  return coeff * Math.pow(p, k) * Math.pow(1 - p, n - k);
}
