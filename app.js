// ===== MathForge App =====
window.MF = {
  apiKey: localStorage.getItem('mf_key') || '',
  currentHomework: '',
};

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initModal();
  initSubmit();
  initClear();
  initToggles();
});

// ===== API Key Modal =====
function initModal() {
  const modal = document.getElementById('api-modal');
  const input = document.getElementById('api-key-input');
  const btn = document.getElementById('api-key-submit');
  const display = document.getElementById('api-key-display');

  if (MF.apiKey) {
    modal.classList.add('hidden');
    display.textContent = MF.apiKey.slice(0, 8) + '...';
  }

  btn.addEventListener('click', () => {
    const key = input.value.trim();
    if (!key) return;
    MF.apiKey = key;
    localStorage.setItem('mf_key', key);
    modal.classList.add('hidden');
    display.textContent = key.slice(0, 8) + '...';
    showToast('API key saved');
  });

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
  display.addEventListener('click', () => {
    modal.classList.remove('hidden');
    input.value = MF.apiKey;
    input.focus();
  });
}

// ===== Collapsible Toggles =====
function initToggles() {
  document.querySelectorAll('.toggle-header').forEach(header => {
    header.addEventListener('click', () => {
      header.classList.toggle('open');
      const body = document.getElementById(header.dataset.target);
      if (body.classList.contains('collapsed')) {
        body.classList.remove('collapsed');
        body.classList.add('expanded');
      } else {
        body.classList.remove('expanded');
        body.classList.add('collapsed');
      }
    });
  });
}

// ===== Main Submit =====
function initSubmit() {
  const btn = document.getElementById('submit-homework');
  const textarea = document.getElementById('homework-input');

  btn.addEventListener('click', () => submitHomework());
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitHomework();
  });
}

async function submitHomework() {
  const textarea = document.getElementById('homework-input');
  const homework = textarea.value.trim();
  if (!homework) return;

  MF.currentHomework = homework;

  // Compact the input area
  document.getElementById('input-section').classList.add('compact');
  // Show results
  document.getElementById('results-section').classList.remove('hidden');

  // Reset cards
  document.getElementById('tutor-response').innerHTML = skeleton(4);
  document.getElementById('deepen-response').innerHTML = skeleton(3);
  document.getElementById('practice-response').innerHTML = skeleton(2);
  document.getElementById('graph-card').classList.add('hidden');
  document.getElementById('plot-container').innerHTML = '';

  // Collapse the dropdowns
  document.querySelectorAll('.toggle-header').forEach(h => h.classList.remove('open'));
  document.querySelectorAll('.card-body.expanded').forEach(b => {
    b.classList.remove('expanded');
    b.classList.add('collapsed');
  });

  // Run ALL three calls in parallel for speed
  const [tutorResult, deepenResult, practiceResult] = await Promise.allSettled([
    callLLM(PROMPTS.tutor, homework),
    callLLM(PROMPTS.deepen, `Student is working on: ${homework}`),
    callLLM(PROMPTS.practice, `Student is working on: ${homework}`),
  ]);

  // Tutor
  const tutorEl = document.getElementById('tutor-response');
  if (tutorResult.status === 'fulfilled') {
    tutorEl.innerHTML = renderMarkdown(tutorResult.value);
    renderMath(tutorEl);
    // Try to plot
    const plotExpr = extractPlotExpr(tutorResult.value);
    if (plotExpr) {
      document.getElementById('graph-card').classList.remove('hidden');
      tryPlot(plotExpr);
    }
  } else {
    tutorEl.innerHTML = errorHTML(tutorResult.reason);
  }

  // Deepen
  const deepenEl = document.getElementById('deepen-response');
  if (deepenResult.status === 'fulfilled') {
    deepenEl.innerHTML = renderMarkdown(deepenResult.value);
    renderMath(deepenEl);
  } else {
    deepenEl.innerHTML = errorHTML(deepenResult.reason);
  }

  // Practice
  const practiceEl = document.getElementById('practice-response');
  if (practiceResult.status === 'fulfilled') {
    const problems = extractJSON(practiceResult.value);
    if (Array.isArray(problems) && problems.length > 0) {
      renderPracticeProblems(problems, practiceEl);
    } else {
      practiceEl.innerHTML = renderMarkdown(practiceResult.value);
      renderMath(practiceEl);
    }
  } else {
    practiceEl.innerHTML = errorHTML(practiceResult.reason);
  }
}

// ===== Practice Problems =====
function renderPracticeProblems(problems, container) {
  container.innerHTML = problems.map((p, i) => `
    <div class="practice-problem" data-answer="${encodeURIComponent(p.answer || '')}">
      <div class="problem-text">${p.problem}</div>
      <div class="answer-row">
        <input type="text" placeholder="Your answer..." id="practice-input-${i}">
        <button class="btn btn-secondary btn-sm" onclick="checkPractice(${i})">Check</button>
      </div>
      <div class="feedback" id="practice-feedback-${i}"></div>
    </div>
  `).join('');
  renderMath(container);
}

async function checkPractice(idx) {
  const input = document.getElementById(`practice-input-${idx}`);
  const feedback = document.getElementById(`practice-feedback-${idx}`);
  const problem = document.querySelectorAll('.practice-problem')[idx];
  const correctAnswer = decodeURIComponent(problem.dataset.answer);
  const userAnswer = input.value.trim();

  if (!userAnswer) return;
  feedback.innerHTML = '<span style="color:var(--text-muted)">Checking...</span>';
  feedback.className = 'feedback';

  try {
    const problemText = problem.querySelector('.problem-text').textContent;
    const response = await callLLM(PROMPTS.check,
      `Problem: ${problemText}\nCorrect: ${correctAnswer}\nStudent: ${userAnswer}`);
    const data = extractJSON(response);

    if (data) {
      feedback.className = `feedback ${data.correct ? 'correct' : 'incorrect'}`;
      feedback.innerHTML = data.feedback || (data.correct ? 'Correct!' : 'Not quite.');
    } else {
      feedback.className = 'feedback';
      feedback.innerHTML = response;
    }
    renderMath(feedback);
  } catch (e) {
    feedback.innerHTML = '<span style="color:var(--orange)">Could not check — try again.</span>';
  }
}
window.checkPractice = checkPractice;

// ===== Plot =====
function tryPlot(expr) {
  const container = document.getElementById('plot-container');
  try {
    let clean = expr
      .replace(/\\/g, '')
      .replace(/\{/g, '(').replace(/\}/g, ')')
      .replace(/\^/g, '**')
      .replace(/sin/g, 'Math.sin')
      .replace(/cos/g, 'Math.cos')
      .replace(/tan/g, 'Math.tan')
      .replace(/sqrt/g, 'Math.sqrt')
      .replace(/ln/g, 'Math.log')
      .replace(/log/g, 'Math.log')
      .replace(/exp/g, 'Math.exp')
      .replace(/pi/g, 'Math.PI')
      .replace(/abs/g, 'Math.abs');
    plotFunction(clean, container);
  } catch (e) {
    try {
      plotFunction(expr.replace(/\^/g, '**'), container);
    } catch {
      container.innerHTML = '';
      document.getElementById('graph-card').classList.add('hidden');
    }
  }
}

// ===== Clear =====
function initClear() {
  document.getElementById('clear-btn').addEventListener('click', () => {
    document.getElementById('input-section').classList.remove('compact');
    document.getElementById('results-section').classList.add('hidden');
    document.getElementById('homework-input').value = '';
    document.getElementById('plot-container').innerHTML = '';
    document.getElementById('homework-input').focus();
  });
}

// ===== Utilities =====
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function skeleton(lines) {
  const widths = ['w100', 'w80', 'w60', 'w40'];
  return '<div class="skeleton">' +
    Array.from({length: lines}, (_, i) =>
      `<div class="skeleton-line ${widths[i % widths.length]}"></div>`
    ).join('') + '</div>';
}

function errorHTML(e) {
  if (e?.message === 'NO_KEY') return '<p style="color:var(--orange)">Set your OpenRouter API key first (click the key badge in the nav).</p>';
  if (e?.message === 'ALL_RATE_LIMITED') return '<p style="color:var(--orange)">All models busy. Wait 30s and try again.</p>';
  return `<p style="color:var(--orange)">Error: ${e?.message || 'Something went wrong'}</p>`;
}

function renderMath(el) {
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
      ],
      throwOnError: false,
    });
  }
}
