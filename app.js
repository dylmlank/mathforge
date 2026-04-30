// ===== MathForge App =====
window.MF = {
  apiKey: localStorage.getItem('mf_key') || '',
  progress: JSON.parse(localStorage.getItem('mf_progress') || '{}'),
  currentTopic: null,
  currentSubtopic: null,
  currentMode: 'learn',
  currentDifficulty: 'easy',
  currentProblem: null,
  quizState: null,
};

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initModal();
  renderSidebar();
  renderHome();
  route();
  window.addEventListener('hashchange', route);
  initModeTabs();
  initDifficulty();
  initPractice();
  initQuiz();
  initHamburger();
  updateProgress();
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

// ===== Sidebar =====
function renderSidebar() {
  const container = document.getElementById('sidebar-topics');
  container.innerHTML = TOPICS.map(topic => `
    <div class="topic-group">
      <div class="topic-label" data-topic="${topic.id}" style="color: ${topic.color}">
        <span>${topic.icon}</span>
        <span>${topic.label}</span>
        <span class="arrow">&#x25B6;</span>
      </div>
      <div class="subtopic-list">
        ${topic.subtopics.map(sub => `
          <a class="subtopic-item" href="#/${topic.id}/${sub.id}" data-key="${topic.id}/${sub.id}">
            <span class="subtopic-dot ${getSubtopicStatus(topic.id, sub.id)}"></span>
            <span>${sub.label}</span>
          </a>
        `).join('')}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.topic-label').forEach(label => {
    label.addEventListener('click', () => {
      label.classList.toggle('expanded');
    });
  });
}

function getSubtopicStatus(topicId, subId) {
  const key = `${topicId}/${subId}`;
  const p = MF.progress[key];
  if (!p) return '';
  if (p.quizBest >= 70) return 'mastered';
  if (p.practiced > 0) return 'practiced';
  return '';
}

// ===== Home Grid =====
function renderHome() {
  const grid = document.getElementById('topic-grid');
  grid.innerHTML = TOPICS.map(topic => `
    <div class="topic-card" data-topic="${topic.id}">
      <div class="topic-card-icon" style="background: ${topic.gradient.replace('linear-gradient', 'linear-gradient').replace(')', ', 0.15)')}; color: ${topic.color}">
        ${topic.icon}
      </div>
      <h3>${topic.label}</h3>
      <p>${topic.subtopics.map(s => s.label).join(', ')}</p>
      <div class="topic-card-count">${topic.subtopics.length} topics</div>
    </div>
  `).join('');

  grid.querySelectorAll('.topic-card').forEach(card => {
    card.addEventListener('click', () => {
      const topicId = card.dataset.topic;
      const topic = TOPICS.find(t => t.id === topicId);
      location.hash = `#/${topicId}/${topic.subtopics[0].id}`;
    });
  });
}

// ===== Router =====
function route() {
  const hash = location.hash || '#/';
  const parts = hash.replace('#/', '').split('/').filter(Boolean);

  if (parts.length < 2) {
    showView('home');
    return;
  }

  const topic = TOPICS.find(t => t.id === parts[0]);
  if (!topic) { showView('home'); return; }
  const sub = topic.subtopics.find(s => s.id === parts[1]);
  if (!sub) { showView('home'); return; }

  MF.currentTopic = topic;
  MF.currentSubtopic = sub;

  showView('topic');
  document.getElementById('topic-title').textContent = sub.label;
  document.getElementById('topic-subtitle').textContent = topic.label;

  // Expand sidebar
  document.querySelectorAll('.sidebar .topic-label').forEach(l => l.classList.remove('expanded'));
  document.querySelectorAll('.sidebar .subtopic-item').forEach(a => a.classList.remove('active'));
  const topicLabel = document.querySelector(`.topic-label[data-topic="${topic.id}"]`);
  if (topicLabel) topicLabel.classList.add('expanded');
  const subItem = document.querySelector(`.subtopic-item[data-key="${topic.id}/${sub.id}"]`);
  if (subItem) subItem.classList.add('active');

  // Load mode
  switchMode(MF.currentMode);
}

function showView(name) {
  document.getElementById('view-home').classList.toggle('hidden', name !== 'home');
  document.getElementById('view-topic').classList.toggle('hidden', name !== 'topic');
}

// ===== Mode Tabs =====
function initModeTabs() {
  document.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      MF.currentMode = tab.dataset.mode;
      switchMode(tab.dataset.mode);
    });
  });
}

function switchMode(mode) {
  document.getElementById('mode-learn').classList.toggle('hidden', mode !== 'learn');
  document.getElementById('mode-practice').classList.toggle('hidden', mode !== 'practice');
  document.getElementById('mode-quiz').classList.toggle('hidden', mode !== 'quiz');
  document.getElementById('plot-container').innerHTML = '';

  if (mode === 'learn') loadLearn();
  if (mode === 'practice') loadPractice();
  if (mode === 'quiz') resetQuizUI();
}

// ===== Learn Mode =====
async function loadLearn() {
  const container = document.getElementById('learn-response');
  container.innerHTML = skeletonHTML();

  try {
    const sub = MF.currentSubtopic;
    const topic = MF.currentTopic;
    const prompt = `Explain "${sub.label}" (${topic.label}). Include: concept overview, key formulas, and one worked example. If relevant, mention what function to graph.`;
    const response = await callLLM(SYSTEM_PROMPTS.explain, prompt);
    container.innerHTML = renderMarkdown(response);
    renderMath(container);
    // Try to plot something relevant
    tryAutoPlot(response);
  } catch (e) {
    container.innerHTML = errorHTML(e);
  }
}

// ===== Practice Mode =====
function initDifficulty() {
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      MF.currentDifficulty = btn.dataset.diff;
      loadPractice();
    });
  });
}

function initPractice() {
  document.getElementById('submit-answer').addEventListener('click', submitAnswer);
  document.getElementById('hint-btn').addEventListener('click', getHint);
  document.getElementById('next-btn').addEventListener('click', loadPractice);
  document.getElementById('answer-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitAnswer();
  });
}

async function loadPractice() {
  const problemArea = document.getElementById('problem-area');
  const feedbackArea = document.getElementById('feedback-area');
  const answerInput = document.getElementById('answer-input');
  problemArea.innerHTML = skeletonHTML();
  feedbackArea.innerHTML = '';
  feedbackArea.className = 'feedback-area';
  answerInput.value = '';
  document.getElementById('plot-container').innerHTML = '';

  try {
    const sub = MF.currentSubtopic;
    const topic = MF.currentTopic;
    const prompt = `Topic: ${sub.label} (${topic.label}). Difficulty: ${MF.currentDifficulty}. Generate 1 problem.`;
    const response = await callLLM(SYSTEM_PROMPTS.generate, prompt);
    const data = extractJSON(response);

    if (data && data.problem) {
      MF.currentProblem = data;
      problemArea.innerHTML = `<div class="problem-text">${data.problem}</div>`;
      renderMath(problemArea);
      // Auto-plot if we can
      if (data.plot_data) tryPlotData(data.plot_data);
    } else {
      // Fallback: render raw response
      MF.currentProblem = { problem: response, answer: '' };
      problemArea.innerHTML = renderMarkdown(response);
      renderMath(problemArea);
    }
  } catch (e) {
    problemArea.innerHTML = errorHTML(e);
  }
}

async function submitAnswer() {
  const input = document.getElementById('answer-input');
  const feedback = document.getElementById('feedback-area');
  const answer = input.value.trim();
  if (!answer || !MF.currentProblem) return;

  feedback.innerHTML = '<div class="skeleton"><div class="skeleton-line wide"></div></div>';

  try {
    const prompt = `Problem: ${MF.currentProblem.problem}\nCorrect answer: ${MF.currentProblem.answer}\nStudent answer: ${answer}\nIs the student correct?`;
    const response = await callLLM(SYSTEM_PROMPTS.check, prompt);
    const data = extractJSON(response);

    if (data) {
      feedback.className = `feedback-area ${data.correct ? 'correct' : 'incorrect'}`;
      feedback.innerHTML = data.feedback || (data.correct ? 'Correct!' : 'Not quite. Try again or get a hint.');
      if (data.correct) {
        trackProgress('practiced');
        if (MF.currentProblem.steps) {
          feedback.innerHTML += '<br><br><strong>Solution:</strong><br>' + MF.currentProblem.steps.join('<br>');
        }
      }
    } else {
      feedback.className = 'feedback-area';
      feedback.innerHTML = renderMarkdown(response);
    }
    renderMath(feedback);
  } catch (e) {
    feedback.innerHTML = errorHTML(e);
  }
}

async function getHint() {
  const feedback = document.getElementById('feedback-area');
  if (!MF.currentProblem) return;
  feedback.innerHTML = '<div class="skeleton"><div class="skeleton-line medium"></div></div>';

  try {
    const prompt = `Problem: ${MF.currentProblem.problem}\nAnswer: ${MF.currentProblem.answer}`;
    const response = await callLLM(SYSTEM_PROMPTS.hint, prompt);
    feedback.className = 'feedback-area';
    feedback.innerHTML = response;
    renderMath(feedback);
  } catch (e) {
    feedback.innerHTML = errorHTML(e);
  }
}

// ===== Quiz Mode =====
function initQuiz() {
  document.getElementById('quiz-submit').addEventListener('click', submitQuizAnswer);
  document.getElementById('quiz-retry').addEventListener('click', startQuiz);
  document.getElementById('quiz-answer-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitQuizAnswer();
  });
}

function resetQuizUI() {
  document.getElementById('quiz-header').classList.remove('hidden');
  document.getElementById('quiz-problem').innerHTML = '<p style="color:var(--text-muted)">Click Start to begin a 5-question quiz</p>';
  document.querySelector('.quiz-input').classList.remove('hidden');
  document.getElementById('quiz-results').classList.add('hidden');
  document.getElementById('quiz-problem').innerHTML = `
    <div style="text-align:center;padding:2rem">
      <p style="color:var(--text-muted);margin-bottom:1rem">Test your knowledge with 5 timed questions</p>
      <button class="btn btn-primary" onclick="startQuiz()">Start Quiz</button>
    </div>`;
}

async function startQuiz() {
  const problemEl = document.getElementById('quiz-problem');
  const resultsEl = document.getElementById('quiz-results');
  resultsEl.classList.add('hidden');
  document.querySelector('.quiz-input').classList.remove('hidden');
  document.getElementById('quiz-header').classList.remove('hidden');
  problemEl.innerHTML = skeletonHTML();

  MF.quizState = { questions: [], idx: 0, score: 0, answers: [], timer: null, timeLeft: 90 };

  // Generate 5 questions
  const sub = MF.currentSubtopic;
  const topic = MF.currentTopic;
  const promises = [];
  for (let i = 0; i < 5; i++) {
    const diff = ['easy', 'medium', 'medium', 'hard', 'hard'][i];
    promises.push(
      callLLM(SYSTEM_PROMPTS.generate, `Topic: ${sub.label} (${topic.label}). Difficulty: ${diff}. Generate 1 problem.`)
        .then(r => extractJSON(r))
        .catch(() => null)
    );
  }

  const results = await Promise.allSettled(promises);
  MF.quizState.questions = results
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter(q => q && q.problem);

  if (MF.quizState.questions.length === 0) {
    problemEl.innerHTML = errorHTML(new Error('Could not generate quiz questions'));
    return;
  }

  showQuizQuestion(0);
  startTimer();
}

function showQuizQuestion(idx) {
  const q = MF.quizState.questions[idx];
  if (!q) return endQuiz();

  document.getElementById('quiz-qnum').textContent = idx + 1;
  const problemEl = document.getElementById('quiz-problem');
  problemEl.innerHTML = q.problem;
  renderMath(problemEl);
  document.getElementById('quiz-answer-input').value = '';
  document.getElementById('quiz-answer-input').focus();
}

function startTimer() {
  MF.quizState.timeLeft = 90;
  updateTimerDisplay();
  MF.quizState.timer = setInterval(() => {
    MF.quizState.timeLeft--;
    updateTimerDisplay();
    if (MF.quizState.timeLeft <= 0) {
      submitQuizAnswer(); // auto-submit
    }
  }, 1000);
}

function updateTimerDisplay() {
  const t = MF.quizState.timeLeft;
  document.getElementById('timer-text').textContent = t;
  const pct = (1 - t / 90) * 113;
  document.getElementById('timer-fg').style.strokeDashoffset = pct;
  if (t <= 10) document.getElementById('timer-fg').style.stroke = '#f97316';
  else document.getElementById('timer-fg').style.stroke = '#8b5cf6';
}

async function submitQuizAnswer() {
  const input = document.getElementById('quiz-answer-input');
  const answer = input.value.trim();
  const q = MF.quizState.questions[MF.quizState.idx];

  // Simple check - ask LLM or do string compare
  if (answer && q) {
    try {
      const response = await callLLM(SYSTEM_PROMPTS.check,
        `Problem: ${q.problem}\nCorrect: ${q.answer}\nStudent: ${answer}\nIs correct?`);
      const data = extractJSON(response);
      if (data && data.correct) MF.quizState.score++;
    } catch { /* skip on error */ }
  }

  clearInterval(MF.quizState.timer);
  MF.quizState.idx++;

  if (MF.quizState.idx < MF.quizState.questions.length) {
    showQuizQuestion(MF.quizState.idx);
    startTimer();
  } else {
    endQuiz();
  }
}

function endQuiz() {
  clearInterval(MF.quizState.timer);
  document.querySelector('.quiz-input').classList.add('hidden');
  document.getElementById('quiz-header').classList.add('hidden');
  document.getElementById('quiz-problem').innerHTML = '';
  const results = document.getElementById('quiz-results');
  results.classList.remove('hidden');

  const total = MF.quizState.questions.length;
  const score = MF.quizState.score;
  const pct = Math.round((score / total) * 100);
  document.getElementById('quiz-score').textContent = `${pct}%`;

  // Track progress
  const key = `${MF.currentTopic.id}/${MF.currentSubtopic.id}`;
  if (!MF.progress[key]) MF.progress[key] = {};
  if (!MF.progress[key].quizBest || pct > MF.progress[key].quizBest) {
    MF.progress[key].quizBest = pct;
  }
  saveProgress();
  updateProgress();
  renderSidebar();
}

// ===== Utilities =====
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function skeletonHTML() {
  return `<div class="skeleton"><div class="skeleton-line wide"></div><div class="skeleton-line medium"></div><div class="skeleton-line short"></div></div>`;
}

function errorHTML(e) {
  if (e.message === 'NO_KEY') return '<p style="color:var(--orange)">Please set your OpenRouter API key (click the key badge in the nav).</p>';
  if (e.message === 'ALL_RATE_LIMITED') return '<p style="color:var(--orange)">All models are rate limited. Try again in 30 seconds.</p>';
  return `<p style="color:var(--orange)">Error: ${e.message}</p>`;
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

function trackProgress(type) {
  if (!MF.currentTopic || !MF.currentSubtopic) return;
  const key = `${MF.currentTopic.id}/${MF.currentSubtopic.id}`;
  if (!MF.progress[key]) MF.progress[key] = {};
  if (type === 'practiced') {
    MF.progress[key].practiced = (MF.progress[key].practiced || 0) + 1;
  }
  saveProgress();
  updateProgress();
}

function saveProgress() {
  localStorage.setItem('mf_progress', JSON.stringify(MF.progress));
}

function updateProgress() {
  const total = TOPICS.reduce((sum, t) => sum + t.subtopics.length, 0);
  const mastered = Object.values(MF.progress).filter(p => p.quizBest >= 70).length;
  const pct = Math.round((mastered / total) * 100);
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent = pct + '%';
}

function tryAutoPlot(text) {
  const container = document.getElementById('plot-container');
  if (!MF.currentSubtopic) return;

  const plotType = MF.currentSubtopic.plotType;
  if (plotType === 'none') return;

  // Try to extract a function from the text
  if (plotType === 'function' || plotType === 'derivative') {
    const match = text.match(/[yf]\s*[=(]\s*x?\s*[)=]\s*(.+?)(?:\$|\\|,|\n|$)/);
    if (match) {
      const expr = match[1].trim()
        .replace(/\\cdot/g, '*').replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
        .replace(/\\sqrt\{([^}]+)\}/g, 'Math.sqrt($1)')
        .replace(/\\sin/g, 'Math.sin').replace(/\\cos/g, 'Math.cos');
      if (plotType === 'derivative') plotDerivative(expr, 1, container);
      else plotFunction(expr, container);
      return;
    }
    // Default demo plot
    if (MF.currentSubtopic.id === 'polynomials') plotFunction('x**3 - 3*x + 1', container);
    else if (MF.currentSubtopic.id === 'derivatives') plotDerivative('x**2', 1, container);
    else plotFunction('x**2 - 4', container);
  } else if (plotType === 'distribution') {
    plotDistribution('normal', [0, 1], container);
  } else if (plotType === 'vector2d') {
    plotVectors2D([[3, 2], [-1, 4]], container);
  } else if (plotType === 'matrix_transform') {
    plotMatrixTransform([[2, 1], [0, 1]], container);
  } else if (plotType === 'histogram') {
    const data = Array.from({length: 200}, () => {
      let u = 0; for (let i = 0; i < 12; i++) u += Math.random(); return u - 6;
    });
    plotHistogram(data, container);
  }
}

function tryPlotData(plotData) {
  // If LLM returned plot info, try to use it
  if (!plotData) return;
  const container = document.getElementById('plot-container');
  if (typeof plotData === 'string') {
    plotFunction(plotData.replace(/\^/g, '**'), container);
  }
}

// Hamburger
function initHamburger() {
  const btn = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  btn.addEventListener('click', () => sidebar.classList.toggle('open'));
  // Close on nav
  sidebar.querySelectorAll('.subtopic-item').forEach(a => {
    a.addEventListener('click', () => sidebar.classList.remove('open'));
  });
}
