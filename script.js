/**
 * ==========================================================================
 * AFNS EXAMINATION DASHBOARD — MODULAR RUNTIME CORE ENGINE
 * ==========================================================================
 */
(function () {
  'use strict';
  // --- APPLICATION STATE VARIABLES CONTAINER ---
  let sessionState = {
    candidateName: '',
    regNumber: '', 
    isActiveExam: false,
    currentQuestionIndex: 0,
    selectedAnswers: {}, 
    secondsRemaining: 0, 
    tabSwitchStrikes: 0,
    activeReviewIndex: 0,
    latestAttemptData: null
  };
  let timerLoopInterval = null;
  // --- UI DOM ELEMENTS MATRIX MAP ---
  const DOM = {
    themeToggle: document.getElementById('theme-toggle'),
    fullscreenToggle: document.getElementById('fullscreen-toggle'),
    loginView: document.getElementById('login-view'),
    dashboardView: document.getElementById('dashboard-view'),
    quizView: document.getElementById('quiz-view'),
    reviewView: document.getElementById('review-view'),
    loginForm: document.getElementById('login-form'),
    candidateNameInput: document.getElementById('candidate-name'),
    portalPasswordInput: document.getElementById('portal-password'),
    dashCandidateName: document.getElementById('dash-candidate-name'),
    dashRegNumber: document.getElementById('dash-reg-number'),
    uiMcqCount: document.getElementById('ui-mcq-count'), 
    uiTimerCount: document.getElementById('ui-timer-count'), 
    logoutBtn: document.getElementById('logout-btn'),
    startExamBtn: document.getElementById('start-exam-btn'),
    activityLog: document.getElementById('activity-log'),
    statAttempts: document.getElementById('stat-attempts'),
    statHigh: document.getElementById('stat-high'),
    statAvg: document.getElementById('stat-avg'),
    statGrade: document.getElementById('stat-grade'),
    attemptsTableBody: document.querySelector('#attempts-table tbody'),
    quizTimer: document.getElementById('quiz-timer'),
    quizProgress: document.getElementById('quiz-progress'),
    questionIndexCounter: document.getElementById('question-index-counter'),
    cheatWarningIndicator: document.getElementById('cheat-warning-indicator'),
    questionText: document.getElementById('question-text'),
    optionsContainer: document.getElementById('options-container'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    submitExamBtn: document.getElementById('submit-exam-btn'),
    matrixGrid: document.getElementById('matrix-grid'),
    exitReviewBtn: document.getElementById('exit-review-btn'),
    reviewIndexCounter: document.getElementById('review-index-counter'),
    reviewVerdictBadge: document.getElementById('review-verdict-badge'),
    reviewQuestionText: document.getElementById('review-question-text'),
    reviewOptionsContainer: document.getElementById('review-options-container'),
    reviewPrevBtn: document.getElementById('review-prev-btn'),
    reviewNextBtn: document.getElementById('review-next-btn'),
    reviewMatrixGrid: document.getElementById('review-matrix-grid'),
    lineChart: document.getElementById('line-chart'),
    pieChart: document.getElementById('pie-chart')
  };
  // --- INITIALIZATION HOOK ---
  window.addEventListener('DOMContentLoaded', () => {
    setupDynamicInterface();
    initSecurityControllers();
    loadPersistentTheme();
    restoreUserSession();
    bindInterfaceEvents();
  });
  // --- DYNAMIC SETUP ---
  function setupDynamicInterface() {
    if (typeof questions === 'undefined') return;
    DOM.uiMcqCount.textContent = `${questions.length} MCQs`;
    const calculatedMinutes = Math.ceil((questions.length * 54) / 60);
    DOM.uiTimerCount.textContent = `${calculatedMinutes} Minutes Duration`;
  }
  // --- SMART DETECTOR HELPER ---
  function verifyDatabaseIntegrity(regNum) {
    const histKey = getCandidateStorageKey(regNum, 'history');
    let pastHistory = JSON.parse(localStorage.getItem(histKey)) || [];
    if (pastHistory.length > 0 && pastHistory[0].auditPayload.length !== questions.length) {
      localStorage.removeItem(histKey);
      localStorage.removeItem(`afns_${regNum.toUpperCase()}_activity_log`);
      localStorage.removeItem(getCandidateStorageKey(regNum, 'quiz_progress_save'));
      return true; // Data wiped
    }
    return false; // Data is safe
  }
  // --- SYSTEM THEME CONTROLS ---
  function loadPersistentTheme() {
    const activeTheme = localStorage.getItem('afns_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', activeTheme);
  }
  function toggleGlobalTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const targetTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', targetTheme);
    localStorage.setItem('afns_theme', targetTheme);
  }
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }
  // --- ANTI-CHEAT & RECOVERY CONTROLS ---
  function initSecurityControllers() {
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && sessionState.isActiveExam) {
        sessionState.tabSwitchStrikes++;
        appendTelemetryLog(`Anti-Cheat warning triggered. Focus deviation event [Strike ${sessionState.tabSwitchStrikes}/3]`);
        
        if (sessionState.tabSwitchStrikes >= 3) {
          appendTelemetryLog('Automatic Submission fired due to maximum Tab Switching threshold violations.');
          executeExamTermination(true);
        } else {
          displayCheatWarning(`WARNING: Tab manipulation detected. The exam will automatically submit on Strike 3. (Current: ${sessionState.tabSwitchStrikes}/3)`);
          saveExamProgressState();
        }
      }
    });
  }
  function displayCheatWarning(message) {
    if (DOM.cheatWarningIndicator) {
      DOM.cheatWarningIndicator.textContent = message;
      DOM.cheatWarningIndicator.classList.remove('hidden');
    }
  }
  // --- LOCALSTORAGE TELEMETRY MATRIX MANAGEMENT ---
  function getCandidateStorageKey(regNum, subKey) {
    return `afns_${regNum.trim().toUpperCase()}_${subKey}`;
  }
  function appendTelemetryLog(message) {
    const reg = sessionState.regNumber || 'GUEST';
    const logKey = `afns_${reg.toUpperCase()}_activity_log`;
    let historicalLogs = JSON.parse(localStorage.getItem(logKey)) || [];
    
    const timeStamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const compiledEntry = `[${timeStamp}] ${message}`;
    
    historicalLogs.unshift(compiledEntry);
    localStorage.setItem(logKey, JSON.stringify(historicalLogs));
    
    renderTelemetryLogDisplay();
  }
  function renderTelemetryLogDisplay() {
    if (!sessionState.regNumber) return;
    const logKey = `afns_${sessionState.regNumber.toUpperCase()}_activity_log`;
    const logs = JSON.parse(localStorage.getItem(logKey)) || [];
    
    DOM.activityLog.innerHTML = '';
    if (logs.length === 0) {
      DOM.activityLog.innerHTML = '<div class="log-item text-muted">No historical events logged.</div>';
      return;
    }
    
    logs.forEach(log => {
      const el = document.createElement('div');
      el.className = 'log-item';
      el.textContent = log;
      DOM.activityLog.appendChild(el);
    });
  }
  // --- SESSION CONTROLLER ROUTERS ---
  function restoreUserSession() {
    const activeReg = localStorage.getItem('afns_active_session_reg');
    const activeName = localStorage.getItem('afns_active_session_name');
    if (activeReg && activeName) {
      // Run Smart Detector on refresh before loading dashboard!
      if (verifyDatabaseIntegrity(activeReg)) {
        alert("System Notice: The examination questions file was changed! Old records have been cleared to prevent errors. Please log in again.");
        processSecureLogout(); // Kick them to login cleanly
        return;
      }
      sessionState.candidateName = activeName;
      sessionState.regNumber = activeReg;
      
      const cachedProgress = localStorage.getItem(getCandidateStorageKey(activeReg, 'quiz_progress_save'));
      if (cachedProgress) {
        sessionState = JSON.parse(cachedProgress);
      }
      
      navigateToView('dashboard');
      synchronizeDashboardMetrics();
      
      if (sessionState.isActiveExam) {
        navigateToView('quiz');
        resumeExamLifecycle();
      }
    } else {
      navigateToView('login');
    }
  }
  function processAuthentication(e) {
    e.preventDefault();
    const inputName = DOM.candidateNameInput.value.trim();
    const inputPassword = DOM.portalPasswordInput.value.trim();
    if (!inputName || !inputPassword) return;
    if (inputPassword !== "Successfulfuture") {
      alert("ACCESS DENIED: Incorrect Password.");
      return;
    }
    sessionState.candidateName = inputName;
    sessionState.regNumber = inputName.toUpperCase().replace(/\s+/g, '_'); 
    // Run Smart Detector on login
    if (verifyDatabaseIntegrity(sessionState.regNumber)) {
      alert("System Notice: The examination database was modified. Old records have been safely cleared to match the new format.");
    }
    localStorage.setItem('afns_active_session_reg', sessionState.regNumber);
    localStorage.setItem('afns_active_session_name', inputName);
    const histKey = getCandidateStorageKey(sessionState.regNumber, 'history');
    if (!localStorage.getItem(histKey)) {
      localStorage.setItem(histKey, JSON.stringify([]));
    }
    appendTelemetryLog(`Candidate ${inputName} authenticated successfully.`);
    navigateToView('dashboard');
    synchronizeDashboardMetrics();
  }
  function processSecureLogout() {
    if (timerLoopInterval) {
      clearInterval(timerLoopInterval);
      timerLoopInterval = null;
    }
    
    // Only log if they were actually logged in
    if (sessionState.regNumber) {
      appendTelemetryLog('Candidate session terminated securely via explicit user logout command.');
    }
    
    localStorage.removeItem('afns_active_session_reg');
    localStorage.removeItem('afns_active_session_name');
    sessionState = {
      candidateName: '',
      regNumber: '',
      isActiveExam: false,
      currentQuestionIndex: 0,
      selectedAnswers: {},
      secondsRemaining: 0,
      tabSwitchStrikes: 0,
      activeReviewIndex: 0,
      latestAttemptData: null
    };
    DOM.loginForm.reset();
    navigateToView('login');
  }
  function navigateToView(viewName) {
    DOM.loginView.classList.remove('active');
    DOM.dashboardView.classList.remove('active');
    DOM.quizView.classList.remove('active');
    DOM.reviewView.classList.remove('active');
    if (viewName === 'login') DOM.loginView.classList.add('active');
    if (viewName === 'dashboard') DOM.dashboardView.classList.add('active');
    if (viewName === 'quiz') DOM.quizView.classList.add('active');
    if (viewName === 'review') DOM.reviewView.classList.add('active');
  }
  // --- DASHBOARD DATA ENGINE & CANVAS CHARTS DRAW ---
  function synchronizeDashboardMetrics() {
    DOM.dashCandidateName.textContent = sessionState.candidateName;
    DOM.dashRegNumber.textContent = `ID: ${sessionState.regNumber}`;
    const historyKey = getCandidateStorageKey(sessionState.regNumber, 'history');
    const attempts = JSON.parse(localStorage.getItem(historyKey)) || [];
    DOM.statAttempts.textContent = attempts.length;
    if (attempts.length === 0) {
      DOM.statHigh.textContent = '0%';
      DOM.statAvg.textContent = '0%';
      DOM.statGrade.textContent = '—';
      renderEmptyCharts();
      renderAttemptsTable([]);
      renderTelemetryLogDisplay();
      return;
    }
    let scores = attempts.map(a => a.percentage);
    let highestScore = Math.max(...scores);
    let averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    let latestGrade = attempts[0].grade;
    DOM.statHigh.textContent = `${highestScore}%`;
    DOM.statAvg.textContent = `${averageScore}%`;
    DOM.statGrade.textContent = latestGrade;
    DOM.statGrade.className = 'stat-value';
    if (latestGrade === 'A' || latestGrade === 'B') DOM.statGrade.classList.add('text-success');
    else if (latestGrade === 'C') DOM.statGrade.classList.add('text-warning');
    else DOM.statGrade.classList.add('text-danger');
    renderAttemptsTable(attempts);
    renderTelemetryLogDisplay();
    generateCanvasVisualizations(attempts);
  }
  function renderAttemptsTable(attempts) {
    DOM.attemptsTableBody.innerHTML = '';
    if (attempts.length === 0) {
      DOM.attemptsTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No historical records saved for this parameter matrix.</td></tr>`;
      return;
    }
    attempts.forEach((attempt, index) => {
      const displayIndex = attempts.length - index;
      const row = document.createElement('tr');
      
      const statusBadge = attempt.passed 
        ? `<span class="badge badge-success">PASSED</span>` 
        : `<span class="badge badge-danger">FAILED</span>`;
      row.innerHTML = `
        <td><strong>#${displayIndex}</strong></td>
        <td>${attempt.percentage}%</td>
        <td class="text-success">${attempt.correctCount}</td>
        <td class="text-danger">${attempt.wrongCount}</td>
        <td class="text-warning">${attempt.skippedCount}</td>
        <td>${attempt.timeTaken}</td>
        <td>${statusBadge}</td>
      `;
      
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => launchReviewWorkflow(attempt));
      
      DOM.attemptsTableBody.appendChild(row);
    });
  }
  function renderEmptyCharts() {
    const ctx1 = DOM.lineChart.getContext('2d');
    const ctx2 = DOM.pieChart.getContext('2d');
    ctx1.clearRect(0, 0, 320, 200);
    ctx2.clearRect(0, 0, 320, 200);
    ctx1.font = '12px sans-serif';
    ctx1.fillStyle = '#64748b';
    ctx1.fillText('No evaluation metrics recorded.', 60, 100);
    ctx2.font = '12px sans-serif';
    ctx2.fillStyle = '#64748b';
    ctx2.fillText('No analytical telemetry cached.', 60, 100);
  }
  function generateCanvasVisualizations(attempts) {
    try {
      drawHistoricalLineChart(attempts);
      drawCategoryPieChart(attempts[0]);
    } catch (err) {
      console.error("Canvas charting error: ", err);
    }
  }
  function drawHistoricalLineChart(attempts) {
    const ctx = DOM.lineChart.getContext('2d');
    ctx.clearRect(0, 0, 320, 200);
    const chronologicalAttempts = [...attempts].reverse();
    const dataPoints = chronologicalAttempts.map(a => a.percentage);
    const padding = 30;
    const graphWidth = 320 - padding * 2;
    const graphHeight = 200 - padding * 2;
    ctx.strokeStyle = '#2a3e63';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, 200 - padding);
    ctx.lineTo(320 - padding, 200 - padding);
    ctx.stroke();
    if (dataPoints.length === 0) return;
    const xStep = dataPoints.length > 1 ? graphWidth / (dataPoints.length - 1) : graphWidth;
    
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    dataPoints.forEach((point, i) => {
      const x = padding + i * xStep;
      const y = (200 - padding) - (point / 100) * graphHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    dataPoints.forEach((point, i) => {
      const x = padding + i * xStep;
      const y = (200 - padding) - (point / 100) * graphHeight;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  function drawCategoryPieChart(latestAttempt) {
    const ctx = DOM.pieChart.getContext('2d');
    ctx.clearRect(0, 0, 320, 200);
    if (!latestAttempt) return;
    const correct = latestAttempt.correctCount || 0;
    const wrong = latestAttempt.wrongCount || 0;
    const skipped = latestAttempt.skippedCount || 0;
    const total = correct + wrong + skipped;
    if (total === 0) return;
    const dataset = [
      { value: correct, color: '#10b981', label: 'Corr.' },
      { value: wrong, color: '#ef4444', label: 'Wrong' },
      { value: skipped, color: '#f59e0b', label: 'Skip' }
    ];
    const centerX = 100;
    const centerY = 100;
    const radius = 70;
    let currentAngle = -Math.PI / 2;
    dataset.forEach(slice => {
      if (slice.value === 0) return;
      const sliceAngle = (slice.value / total) * Math.PI * 2;
      ctx.fillStyle = slice.color;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();
      currentAngle += sliceAngle;
    });
    ctx.font = '11px monospace';
    dataset.forEach((slice, idx) => {
      const yOffset = 50 + idx * 25;
      ctx.fillStyle = slice.color;
      ctx.fillRect(190, yOffset, 12, 12);
      ctx.fillStyle = document.documentElement.getAttribute('data-theme') === 'light' ? '#0f172a' : '#f1f5f9';
      ctx.fillText(`${slice.label}: ${slice.value}`, 210, yOffset + 10);
    });
  }
  // --- EXAMINATION RUNTIME ENGAGEMENT MACHINE ---
  function initializeExamCycle() {
    sessionState.isActiveExam = true;
    sessionState.currentQuestionIndex = 0;
    sessionState.selectedAnswers = {};
    sessionState.secondsRemaining = questions.length * 54; 
    sessionState.tabSwitchStrikes = 0;
    
    if (DOM.cheatWarningIndicator) {
      DOM.cheatWarningIndicator.classList.add('hidden');
    }
    appendTelemetryLog('New official verification evaluation window initiated.');
    saveExamProgressState();
    
    navigateToView('quiz');
    buildNavigationMatrixGrid();
    renderActiveQuestionFrame();
    launchTimerDaemon();
  }
  function resumeExamLifecycle() {
    buildNavigationMatrixGrid();
    renderActiveQuestionFrame();
    launchTimerDaemon();
    
    if (sessionState.tabSwitchStrikes > 0) {
      displayCheatWarning(`WARNING: Tab manipulation detected. The exam will automatically submit on Strike 3. (Current: ${sessionState.tabSwitchStrikes}/3)`);
    }
  }
  function saveExamProgressState() {
    if (!sessionState.regNumber) return;
    const saveKey = getCandidateStorageKey(sessionState.regNumber, 'quiz_progress_save');
    localStorage.setItem(saveKey, JSON.stringify(sessionState));
  }
  function clearExamProgressCache() {
    if (!sessionState.regNumber) return;
    const saveKey = getCandidateStorageKey(sessionState.regNumber, 'quiz_progress_save');
    localStorage.removeItem(saveKey);
  }
  function launchTimerDaemon() {
    if (timerLoopInterval) clearInterval(timerLoopInterval);
    
    updateTimerInterfaceDisplay();
    timerLoopInterval = setInterval(() => {
      sessionState.secondsRemaining--;
      updateTimerInterfaceDisplay();
      
      if (sessionState.secondsRemaining % 5 === 0) {
        saveExamProgressState();
      }
      if (sessionState.secondsRemaining <= 0) {
        clearInterval(timerLoopInterval);
        appendTelemetryLog('Examination timer terminal interrupt: Maximum duration threshold elapsed.');
        executeExamTermination(false);
      }
    }, 1000);
  }
  function updateTimerInterfaceDisplay() {
    const mins = Math.floor(sessionState.secondsRemaining / 60);
    const secs = sessionState.secondsRemaining % 60;
    DOM.quizTimer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  // --- QUESTION SCREEN MANIPULATION MATRIX ---
  function buildNavigationMatrixGrid() {
    DOM.matrixGrid.innerHTML = '';
    questions.forEach((_, idx) => {
      const cell = document.createElement('div');
      cell.className = 'matrix-cell';
      cell.textContent = idx + 1;
      
      if (idx === sessionState.currentQuestionIndex) cell.classList.add('current');
      if (sessionState.selectedAnswers[idx] !== undefined) cell.classList.add('answered');
      
      cell.addEventListener('click', () => jumpToQuestionIndex(idx));
      DOM.matrixGrid.appendChild(cell);
    });
  }
  function renderActiveQuestionFrame() {
    const currentQuestion = questions[sessionState.currentQuestionIndex];
    DOM.questionIndexCounter.textContent = `Question ${sessionState.currentQuestionIndex + 1} of ${questions.length}`;
    DOM.questionText.textContent = currentQuestion.question;
    
    const completionPercentage = Math.round(((sessionState.currentQuestionIndex + 1) / questions.length) * 100);
    DOM.quizProgress.style.width = `${completionPercentage}%`;
    DOM.optionsContainer.innerHTML = '';
    currentQuestion.options.forEach((option, idx) => {
      const prefixOptionMap = ['A', 'B', 'C', 'D'];
      const currentPrefix = prefixOptionMap[idx];
      
      const optionRow = document.createElement('div');
      optionRow.className = 'option-cell';
      if (sessionState.selectedAnswers[sessionState.currentQuestionIndex] === currentPrefix) {
        optionRow.classList.add('selected');
      }
      optionRow.innerHTML = `
        <span class="option-prefix">${currentPrefix}</span>
        <span class="option-label-text">${option}</span>
      `;
      optionRow.addEventListener('click', () => registerOptionSelection(currentPrefix));
      DOM.optionsContainer.appendChild(optionRow);
    });
    DOM.prevBtn.disabled = (sessionState.currentQuestionIndex === 0);
    DOM.nextBtn.disabled = (sessionState.currentQuestionIndex === questions.length - 1);
    const cells = DOM.matrixGrid.querySelectorAll('.matrix-cell');
    cells.forEach((cell, idx) => {
      cell.classList.remove('current');
      if (idx === sessionState.currentQuestionIndex) cell.classList.add('current');
    });
  }
  function registerOptionSelection(letterPrefix) {
    sessionState.selectedAnswers[sessionState.currentQuestionIndex] = letterPrefix;
    const targetCell = DOM.matrixGrid.children[sessionState.currentQuestionIndex];
    if (targetCell) targetCell.classList.add('answered');
    renderActiveQuestionFrame();
    saveExamProgressState();
  }
  function jumpToQuestionIndex(targetIdx) {
    if (targetIdx >= 0 && targetIdx < questions.length) {
      sessionState.currentQuestionIndex = targetIdx;
      renderActiveQuestionFrame();
      saveExamProgressState();
    }
  }
  // --- TERMINATION & SCORING CALCULATOR ENGINE ---
  function executeExamTermination(wasForceSubmitted = false) {
    if (timerLoopInterval) {
      clearInterval(timerLoopInterval);
      timerLoopInterval = null;
    }
    sessionState.isActiveExam = false;
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    const fullAuditLogAnswers = [];
    questions.forEach((q, idx) => {
      const candidateChoice = sessionState.selectedAnswers[idx];
      const actualAnswer = q.answer.trim().toUpperCase();
      
      fullAuditLogAnswers.push({
        questionIdx: idx,
        candidateSelection: candidateChoice || null,
        correctSelection: actualAnswer
      });
      if (candidateChoice === undefined) {
        skippedCount++;
      } else if (candidateChoice === actualAnswer) {
        correctCount++;
      } else {
        wrongCount++;
      }
    });
    const finalRawPercentage = Math.round((correctCount / questions.length) * 100);
    
    let derivedGrade = 'F';
    if (finalRawPercentage >= 85) derivedGrade = 'A';
    else if (finalRawPercentage >= 70) derivedGrade = 'B';
    else if (finalRawPercentage >= 50) derivedGrade = 'C';
    const isPass = finalRawPercentage >= 50;
    const totalAllocatedTime = questions.length * 54;
    const timeSpentSeconds = totalAllocatedTime - sessionState.secondsRemaining;
    const computedMins = Math.floor(timeSpentSeconds / 60);
    const computedSecs = timeSpentSeconds % 60;
    const formattedDuration = `${computedMins}m ${computedSecs}s`;
    const performanceAttemptRecord = {
      timestamp: new Date().toISOString(),
      correctCount: correctCount,
      wrongCount: wrongCount,
      skippedCount: skippedCount,
      percentage: finalRawPercentage,
      grade: derivedGrade,
      passed: isPass,
      timeTaken: formattedDuration,
      auditPayload: fullAuditLogAnswers
    };
    const historyKey = getCandidateStorageKey(sessionState.regNumber, 'history');
    let historicalCollection = JSON.parse(localStorage.getItem(historyKey)) || [];
    historicalCollection.unshift(performanceAttemptRecord);
    localStorage.setItem(historyKey, JSON.stringify(historicalCollection));
    if (wasForceSubmitted) {
      appendTelemetryLog(`Exam FORCE COMPLIED. Score achieved: ${finalRawPercentage}%. Grade: ${derivedGrade}.`);
    } else {
      appendTelemetryLog(`Exam completed normally. Final metrics compiled: ${finalRawPercentage}%. Grade: ${derivedGrade}.`);
    }
    clearExamProgressCache();
    synchronizeDashboardMetrics();
    navigateToView('dashboard');
  }
  // --- POST-EXAM AUDIT & REVIEW MATRIX ENGINE ---
  function launchReviewWorkflow(attemptRecord) {
    sessionState.latestAttemptData = attemptRecord;
    sessionState.activeReviewIndex = 0;
    
    navigateToView('review');
    buildReviewMatrixGrid();
    renderReviewQuestionFrame();
  }
  function buildReviewMatrixGrid() {
    DOM.reviewMatrixGrid.innerHTML = '';
    const auditData = sessionState.latestAttemptData.auditPayload;
    questions.forEach((_, idx) => {
      const cell = document.createElement('div');
      cell.className = 'matrix-cell';
      cell.textContent = idx + 1;
      const itemAudit = auditData[idx];
      
      if (itemAudit.candidateSelection === null) {
        cell.classList.add('review-skipped');
      } else if (itemAudit.candidateSelection === itemAudit.correctSelection) {
        cell.classList.add('review-correct');
      } else {
        cell.classList.add('review-wrong');
      }
      if (idx === sessionState.activeReviewIndex) {
        cell.classList.add('current');
      }
      cell.addEventListener('click', () => {
        sessionState.activeReviewIndex = idx;
        renderReviewQuestionFrame();
      });
      DOM.reviewMatrixGrid.appendChild(cell);
    });
  }
  function renderReviewQuestionFrame() {
    const idx = sessionState.activeReviewIndex;
    const targetQuestion = questions[idx];
    const itemAudit = sessionState.latestAttemptData.auditPayload[idx];
    DOM.reviewIndexCounter.textContent = `Review Item ${idx + 1} of ${questions.length}`;
    DOM.reviewQuestionText.textContent = targetQuestion.question;
    DOM.reviewVerdictBadge.className = 'badge';
    if (itemAudit.candidateSelection === null) {
      DOM.reviewVerdictBadge.textContent = 'SKIPPED';
      DOM.reviewVerdictBadge.classList.add('badge-warning');
    } else if (itemAudit.candidateSelection === itemAudit.correctSelection) {
      DOM.reviewVerdictBadge.textContent = 'CORRECT';
      DOM.reviewVerdictBadge.classList.add('badge-success');
    } else {
      DOM.reviewVerdictBadge.textContent = 'INCORRECT';
      DOM.reviewVerdictBadge.classList.add('badge-danger');
    }
    DOM.reviewOptionsContainer.innerHTML = '';
    targetQuestion.options.forEach((option, opIdx) => {
      const prefixOptionMap = ['A', 'B', 'C', 'D'];
      const currentPrefix = prefixOptionMap[opIdx];
      
      const optionRow = document.createElement('div');
      optionRow.className = 'option-cell';
      if (currentPrefix === itemAudit.correctSelection) {
        optionRow.classList.add('correct-review-target');
      } else if (currentPrefix === itemAudit.candidateSelection) {
        optionRow.classList.add('wrong-review-target');
      }
      optionRow.innerHTML = `
        <span class="option-prefix">${currentPrefix}</span>
        <span class="option-label-text">${option}</span>
      `;
      DOM.reviewOptionsContainer.appendChild(optionRow);
    });
    DOM.reviewPrevBtn.disabled = (idx === 0);
    DOM.reviewNextBtn.disabled = (idx === questions.length - 1);
    const cells = DOM.reviewMatrixGrid.querySelectorAll('.matrix-cell');
    cells.forEach((cell, cIdx) => {
      cell.classList.remove('current');
      if (cIdx === idx) cell.classList.add('current');
    });
  }
  // --- VOLATILE ROUTING BINDING INTERFACES ---
  function bindInterfaceEvents() {
    DOM.themeToggle.addEventListener('click', toggleGlobalTheme);
    DOM.fullscreenToggle.addEventListener('click', toggleFullscreen);
    DOM.loginForm.addEventListener('submit', processAuthentication);
    DOM.logoutBtn.addEventListener('click', processSecureLogout);
    
    DOM.startExamBtn.addEventListener('click', initializeExamCycle);
    
    DOM.prevBtn.addEventListener('click', () => jumpToQuestionIndex(sessionState.currentQuestionIndex - 1));
    DOM.nextBtn.addEventListener('click', () => jumpToQuestionIndex(sessionState.currentQuestionIndex + 1));
    
    DOM.submitExamBtn.addEventListener('click', () => {
      if (confirm('Are you absolutely sure you want to finalize this examination block for academic grading?')) {
        executeExamTermination(false);
      }
    });
    DOM.reviewPrevBtn.addEventListener('click', () => {
      if (sessionState.activeReviewIndex > 0) {
        sessionState.activeReviewIndex--;
        renderReviewQuestionFrame();
      }
    });
    DOM.reviewNextBtn.addEventListener('click', () => {
      if (sessionState.activeReviewIndex < questions.length - 1) {
        sessionState.activeReviewIndex++;
        renderReviewQuestionFrame();
      }
    });
    DOM.exitReviewBtn.addEventListener('click', () => {
      navigateToView('dashboard');
      synchronizeDashboardMetrics();
    });
  }
})();
