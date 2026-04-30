// ===== Desmos Graph Module =====
let calculator = null;

function initGraph(container) {
  if (calculator) calculator.destroy();
  container.innerHTML = '';
  container.style.height = '350px';
  calculator = Desmos.GraphingCalculator(container, {
    expressions: false,
    settingsMenu: false,
    zoomButtons: true,
    backgroundColor: '#12121a',
    textColor: '#e4e4ef',
  });
  return calculator;
}

function plotExpression(expr, container) {
  container = container || document.getElementById('plot-container');
  const calc = initGraph(container);
  // Clean expression for Desmos (it accepts LaTeX-like syntax natively)
  let clean = expr.trim()
    .replace(/[.,;:!?]+$/, '')       // trailing punctuation
    .replace(/\*\*/g, '^')           // JS power back to caret
    .replace(/Math\.(sin|cos|tan|sqrt|log|abs|exp|PI|E)/g, (_, fn) => {
      if (fn === 'PI') return '\\pi';
      if (fn === 'E') return 'e';
      return '\\' + fn;
    })
    .replace(/\*/g, ' \\cdot ')      // explicit multiply to cdot
    .replace(/(?<!\w)pi(?!\w)/g, '\\pi');

  calc.setExpression({ id: 'main', latex: `y=${clean}`, color: '#8b5cf6' });
}
