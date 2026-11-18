/* Race Limits · общий скрипт сайта.
   Задачи лежат в data.js (window.TASKS), формулы шпаргалки — ниже. */
(function () {
  'use strict';

  // ---------- MathJax: перерисовать формулы в элементе ----------
  function typeset(el) {
    var mj = window.MathJax;
    if (!mj || !mj.startup || !mj.startup.promise) return;
    mj.startup.promise
      .then(function () { if (mj.typesetClear) mj.typesetClear([el]); return mj.typesetPromise([el]); })
      .catch(function () {});
  }

  // '<' и '>' внутри формулы браузер может принять за HTML-тег
  function safeTex(t) { return String(t).replace(/</g, '\\lt ').replace(/>/g, '\\gt '); }

  var LEVEL_NAME = { easy: 'Легкий', medium: 'Средний', hard: 'Сложный' };
  var TOPIC_NAME = {
    point: 'Предел в точке', infinity: 'Предел на бесконечности', remarkable: 'Первый замечательный предел',
    'one-sided': 'Односторонние пределы', continuity: 'Непрерывность', asymptote: 'Асимптоты'
  };

  // ---------- Разбор ответа ученика ----------
  function parseNumber(s) {
    s = s.trim().replace(/\s+/g, '').replace(/,/g, '.').replace(/−/g, '-');
    if (!s) return NaN;
    if (/^(\+)?(∞|inf|infinity|бесконечность)$/.test(s)) return Infinity;
    if (/^-(∞|inf|infinity|бесконечность)$/.test(s)) return -Infinity;
    var m = s.match(/^([+-]?\d*\.?\d+)\/([+-]?\d*\.?\d+)$/);
    if (m) return parseFloat(m[1]) / parseFloat(m[2]);
    if (/^[+-]?\d*\.?\d+$/.test(s)) return parseFloat(s);
    return NaN;
  }
  function isNone(s) {
    return /^(нет|не\s*сущ|несущ|dne|none|∅)/.test(s.trim().toLowerCase());
  }
  function same(a, b) {
    if (!isFinite(a) || !isFinite(b)) return a === b;
    return Math.abs(a - b) < 1e-6;
  }
  function splitList(s) {
    s = s.replace(/^[xyху]\s*=/i, '');
    var parts = s.indexOf(';') >= 0 ? s.split(';') : (s.split(',').length > 1 && !/^\s*-?\d+,\d+\s*$/.test(s) ? s.split(',') : s.split(/\s+/));
    return parts.map(function (p) { return p.replace(/^\s*[xyху]\s*=/i, ''); }).filter(function (p) { return p.trim() !== ''; });
  }
  function parseLine(s) {
    // принимает "1;-1" или "y=x-1", "y=-x", "y = 2x + 3"
    var t = s.toLowerCase().replace(/\s+/g, '').replace(/,/g, '.').replace(/−/g, '-').replace(/х/g, 'x').replace(/у/g, 'y');
    if (t.indexOf('x') < 0) {
      var p = splitList(s).map(parseNumber);
      return p.length === 2 ? p : null;
    }
    t = t.replace(/^y=/, '');
    var m = t.match(/^([+-]?[\d./]*)\*?x([+-][\d./]+)?$/);
    if (!m) return null;
    var k = m[1] === '' || m[1] === '+' ? 1 : (m[1] === '-' ? -1 : parseNumber(m[1]));
    var b = m[2] ? parseNumber(m[2]) : 0;
    return [k, b];
  }
  function checkAnswer(task, raw) {
    var s = (raw || '').trim();
    if (!s) return null;
    if (task.answer === 'none') return isNone(s);
    if (isNone(s)) return false;
    if (task.type === 'num') {
      var v = parseNumber(s.replace(/^[xyaху]\s*=/i, ''));
      return same(v, parseNumber(task.answer));
    }
    if (task.type === 'set') {
      var want = task.answer.split(';').map(parseNumber).sort(function (a, b) { return a - b; });
      var got = splitList(s).map(parseNumber).sort(function (a, b) { return a - b; });
      return got.length === want.length && got.every(function (g, i) { return same(g, want[i]); });
    }
    if (task.type === 'line') {
      var w = task.answer.split(';').map(parseNumber), g = parseLine(s);
      return !!g && same(g[0], w[0]) && same(g[1], w[1]);
    }
    return false;
  }
  function answerTex(task) {
    if (task.answer === 'none') return '\\text{не существует}';
    if (task.type === 'line') {
      var kb = task.answer.split(';').map(parseNumber), k = kb[0], b = kb[1];
      var kt = k === 1 ? '' : (k === -1 ? '-' : String(k));
      return 'y=' + kt + 'x' + (b === 0 ? '' : (b > 0 ? '+' + b : String(b)));
    }
    return task.answer.split(';').map(function (a) {
      a = a.trim();
      if (a === '+inf') return '+\\infty';
      if (a === '-inf') return '-\\infty';
      var m = a.match(/^(-?)(\d+)\/(\d+)$/);
      return m ? m[1] + '\\frac{' + m[2] + '}{' + m[3] + '}' : a;
    }).join(';\\ ');
  }

  // ---------- Тренажер ----------
  function initTrainer() {
    var taskEl = document.getElementById('task');
    if (!taskEl || !window.TASKS) return;
    var modeEl = document.getElementById('mode'), input = document.getElementById('answer');
    var feedback = document.getElementById('feedback'), hint = document.getElementById('hint'), sol = document.getElementById('solution');
    var meta = document.getElementById('task-meta'), score = document.getElementById('score');
    var current = null, history = [], solved = 0, tried = 0, answered = false;

    function pool(mode) {
      var all = window.TASKS;
      if (mode === 'mixed') return all;
      if (LEVEL_NAME[mode]) return all.filter(function (t) { return t.level === mode; });
      return all.filter(function (t) { return t.topic === mode; });
    }
    function next() {
      var p = pool(modeEl.value);
      var fresh = p.filter(function (t) { return history.indexOf(t.id) < 0; });
      if (!fresh.length) { history = []; fresh = p; }
      current = fresh[Math.floor(Math.random() * fresh.length)];
      history.push(current.id);
      answered = false;
      taskEl.innerHTML = '<p class="task-q">' + current.q + '</p><div>\\[' + safeTex(current.tex) + '\\]</div>';
      if (meta) meta.innerHTML = '<span class="tag">' + LEVEL_NAME[current.level] + '</span> <span class="tag">' + TOPIC_NAME[current.topic] + '</span> <span class="tag">Цель ' + current.goal + '</span> <span class="src">' + current.src + '</span>';
      hint.innerHTML = current.hint;
      sol.innerHTML = current.solution + '<br><b>Ответ:</b> \\(' + answerTex(current) + '\\)';
      feedback.textContent = 'Введи ответ и нажми «Проверить».';
      feedback.className = 'result';
      input.value = '';
      document.querySelectorAll('.quiz-card details').forEach(function (d) { d.open = false; });
      typeset(document.querySelector('.quiz-card'));
    }
    function check() {
      if (!current) return;
      var r = checkAnswer(current, input.value);
      if (r === null) { feedback.textContent = 'Сначала введи ответ.'; feedback.className = 'result'; return; }
      if (!answered) { tried++; if (r) solved++; answered = true; }
      if (r) {
        feedback.innerHTML = '✅ Верно! Финишный флаг 🏁 Ответ: \\(' + answerTex(current) + '\\)';
        feedback.className = 'result ok';
      } else {
        feedback.textContent = '❌ Пока не так. Открой подсказку и попробуй ещё раз.';
        feedback.className = 'result bad';
      }
      if (score) score.textContent = 'Круги: ' + solved + ' из ' + tried;
      typeset(feedback);
    }
    document.getElementById('new-task').addEventListener('click', next);
    document.getElementById('check').addEventListener('click', check);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') check(); });
    modeEl.addEventListener('change', next);
    next();
  }

  // ---------- Шпаргалка ----------
  var SHEET = [
    { tag: 'Определение', title: 'Предел функции в точке', tex: '\\lim_{x\\to a}f(x)=A', note: 'Значения \\(f(x)\\) сколь угодно близки к \\(A\\), когда \\(x\\) близко к \\(a\\), \\(x\\ne a\\).' },
    { tag: 'Подстановка', title: 'Если функция непрерывна в точке', tex: '\\lim_{x\\to a}f(x)=f(a)', note: 'Первым делом всегда подставляй \\(x=a\\).' },
    { tag: 'Свойства', title: 'Арифметика пределов', tex: '\\lim(f\\pm g)=A\\pm B,\\quad \\lim(f\\cdot g)=A\\cdot B,\\quad \\lim\\frac{f}{g}=\\frac{A}{B}\\ (B\\ne0)', note: 'Где \\(\\lim f=A\\), \\(\\lim g=B\\).' },
    { tag: '0/0', title: 'Квадратный трёхчлен', tex: 'ax^2+bx+c=a(x-x_1)(x-x_2)', note: 'Если подстановка дала \\(\\frac00\\), то \\(x-a\\) — общий множитель.' },
    { tag: '0/0', title: 'Формулы сокращённого умножения', tex: 'a^2-b^2=(a-b)(a+b),\\quad a^3\\pm b^3=(a\\pm b)(a^2\\mp ab+b^2)', note: 'Нужны в задачах № 11164, 11172, 11175, 11176, 11180, 11181.' },
    { tag: '∞ − ∞', title: 'Сопряжённое выражение', tex: '\\sqrt{A}-\\sqrt{B}=\\frac{A-B}{\\sqrt{A}+\\sqrt{B}}', note: 'Помогает в № 11213, 11214.' },
    { tag: '∞/∞', title: 'Отношение многочленов', tex: '\\lim_{x\\to\\infty}\\frac{a_kx^k+\\dots}{b_mx^m+\\dots}=\\begin{cases}0, & k<m,\\\\ \\dfrac{a_k}{b_m}, & k=m,\\\\ \\infty, & k>m.\\end{cases}', note: 'Сравни старшие степени.' },
    { tag: '∞', title: 'Бесконечно малые', tex: '\\lim_{x\\to\\infty}\\frac{c}{x^p}=0\\quad (p>0)', note: 'Поэтому после деления на старшую степень «хвосты» исчезают.' },
    { tag: 'Корень', title: 'Знак при x → −∞', tex: '\\sqrt{x^2}=|x|=-x\\quad\\text{при } x<0', note: 'Ловушка задачи № 11169.' },
    { tag: '10.5.1.9', title: 'Первый замечательный предел', tex: '\\lim_{x\\to0}\\frac{\\sin x}{x}=1', note: 'Аргумент синуса и знаменатель должны совпадать.' },
    { tag: '10.5.1.9', title: 'Следствия', tex: '\\lim_{x\\to0}\\frac{\\sin kx}{mx}=\\frac{k}{m},\\quad \\lim_{x\\to0}\\frac{\\operatorname{tg}kx}{mx}=\\frac{k}{m},\\quad \\lim_{x\\to0}\\frac{kx}{\\sin mx}=\\frac{k}{m}', note: 'Задачи № 11196–11200.' },
    { tag: '10.5.1.10', title: 'Односторонние пределы', tex: '\\lim_{x\\to a}f(x)=A\\iff\\lim_{x\\to a-0}f(x)=\\lim_{x\\to a+0}f(x)=A', note: 'Если левый и правый пределы различны, предела в точке нет.' },
    { tag: '10.5.1.10', title: 'Деление на «почти ноль»', tex: '\\frac{c}{\\to0^{+}}\\to+\\infty,\\qquad \\frac{c}{\\to0^{-}}\\to-\\infty\\qquad (c>0)', note: 'Определи знак знаменателя слева и справа от точки.' },
    { tag: 'Непрерывность', title: 'Непрерывность в точке', tex: '\\lim_{x\\to a-0}f(x)=\\lim_{x\\to a+0}f(x)=f(a)', note: 'Устранимый разрыв: предел есть, но \\(f(a)\\) не задано или другое.' },
    { tag: '10.5.1.11', title: 'Вертикальная асимптота', tex: 'x=a,\\quad\\text{если}\\ \\lim_{x\\to a\\pm0}f(x)=\\pm\\infty', note: 'Хотя бы с одной стороны. Кандидаты — нули знаменателя.' },
    { tag: '10.5.1.11', title: 'Горизонтальная асимптота', tex: 'y=b,\\quad b=\\lim_{x\\to\\pm\\infty}f(x)', note: 'Если предел конечен.' },
    { tag: '10.5.1.11', title: 'Наклонная асимптота', tex: 'y=kx+b,\\quad k=\\lim_{x\\to\\infty}\\frac{f(x)}{x},\\quad b=\\lim_{x\\to\\infty}\\bigl(f(x)-kx\\bigr)', note: 'Существует, если оба предела конечны и \\(k\\ne0\\).' }
  ];

  function copyText(text, btn) {
    function done() { var old = btn.textContent; btn.textContent = 'Скопировано ✓'; setTimeout(function () { btn.textContent = old; }, 1400); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  function initSheet() {
    var grid = document.getElementById('sheet-grid');
    if (!grid) return;
    grid.innerHTML = SHEET.map(function (c, i) {
      return '<article class="formula-card"><span class="tag">' + c.tag + '</span><h3>' + c.title + '</h3>' +
        '<div class="equation">\\[' + safeTex(c.tex) + '\\]</div><p>' + c.note + '</p>' +
        '<button type="button" data-i="' + i + '">Копировать LaTeX</button></article>';
    }).join('');
    grid.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]');
      if (b) copyText(SHEET[+b.dataset.i].tex, b);
    });
    typeset(grid);
  }

  // ---------- Теория: проколотая точка ----------
  function initHole() {
    var canvas = document.getElementById('hole-canvas'), slider = document.getElementById('hole-slider');
    if (!canvas || !slider) return;
    var out = document.getElementById('hole-x'), text = document.getElementById('hole-text');
    var ctx = canvas.getContext('2d');
    var X0 = 0, X1 = 4, Y0 = -0.5, Y1 = 5.5;

    function draw() {
      var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var pad = 34;
      function px(x) { return pad + (x - X0) / (X1 - X0) * (w - 2 * pad); }
      function py(y) { return h - pad - (y - Y0) / (Y1 - Y0) * (h - 2 * pad); }
      ctx.clearRect(0, 0, w, h);
      // сетка
      ctx.strokeStyle = '#eee3cf'; ctx.lineWidth = 1;
      for (var gx = X0; gx <= X1; gx++) { ctx.beginPath(); ctx.moveTo(px(gx), py(Y0)); ctx.lineTo(px(gx), py(Y1)); ctx.stroke(); }
      for (var gy = 0; gy <= 5; gy++) { ctx.beginPath(); ctx.moveTo(px(X0), py(gy)); ctx.lineTo(px(X1), py(gy)); ctx.stroke(); }
      // оси
      ctx.strokeStyle = '#151820'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px(X0), py(0)); ctx.lineTo(px(X1), py(0)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(0), py(Y0)); ctx.lineTo(px(0), py(Y1)); ctx.stroke();
      ctx.fillStyle = '#606775'; ctx.font = '12px system-ui, sans-serif';
      for (var t = 1; t <= 4; t++) ctx.fillText(String(t), px(t) - 3, py(0) + 15);
      for (var s = 1; s <= 5; s++) ctx.fillText(String(s), px(0) - 14, py(s) + 4);
      // график y = x + 1 с выколотой точкой
      ctx.strokeStyle = '#1f4e79'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(px(X0), py(X0 + 1)); ctx.lineTo(px(X1), py(X1 + 1)); ctx.stroke();
      ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(px(2), py(3), 6, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      // значение f(2) = 1
      ctx.fillStyle = '#c62828'; ctx.beginPath(); ctx.arc(px(2), py(1), 6, 0, 2 * Math.PI); ctx.fill();
      ctx.fillText('f(2) = 1', px(2) + 10, py(1) + 4);
      // уровень 3
      ctx.setLineDash([5, 5]); ctx.strokeStyle = '#c62828'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(px(0), py(3)); ctx.lineTo(px(2), py(3)); ctx.stroke(); ctx.setLineDash([]);
      // машинка
      var xv = slider.value / 100, yv = xv === 2 ? 1 : xv + 1;
      ctx.font = '24px system-ui, sans-serif'; ctx.fillText('🏎️', px(xv) - 14, py(yv) - 8);
      ctx.fillStyle = '#f1c232'; ctx.beginPath(); ctx.arc(px(xv), py(yv), 5, 0, 2 * Math.PI); ctx.fill();
      out.textContent = xv.toFixed(2);
      text.textContent = xv === 2
        ? 'x = 2: значение функции f(2) = 1, но предел при x → 2 равен 3. Предел ≠ значение!'
        : 'x = ' + xv.toFixed(2) + ', f(x) = ' + yv.toFixed(2) + '. Чем ближе x к 2, тем ближе f(x) к 3.';
    }
    slider.addEventListener('input', draw);
    window.addEventListener('resize', draw);
    draw();
  }

  // ---------- Универсальный рисовальщик графиков ----------
  function makePlot(canvas, view) {
    var ctx = canvas.getContext('2d'), pad = 30, w, h;
    function size() {
      var dpr = window.devicePixelRatio || 1; w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function px(x) { return pad + (x - view.x0) / (view.x1 - view.x0) * (w - 2 * pad); }
    function py(y) { return h - pad - (y - view.y0) / (view.y1 - view.y0) * (h - 2 * pad); }
    function step(a) { var r = a / 6, p = Math.pow(10, Math.floor(Math.log10(r))), m = r / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : 5) * p; }
    var api = {
      ctx: ctx, px: px, py: py,
      begin: function () {
        size(); ctx.clearRect(0, 0, w, h);
        var sx = view.stepX || step(view.x1 - view.x0), sy = view.stepY || step(view.y1 - view.y0);
        ctx.lineWidth = 1; ctx.strokeStyle = '#eee3cf'; ctx.fillStyle = '#606775'; ctx.font = '11px system-ui, sans-serif';
        for (var gx = Math.ceil(view.x0 / sx) * sx; gx <= view.x1; gx += sx) {
          ctx.beginPath(); ctx.moveTo(px(gx), py(view.y0)); ctx.lineTo(px(gx), py(view.y1)); ctx.stroke();
          if (Math.abs(gx) > 1e-9) ctx.fillText(+gx.toFixed(2), px(gx) - 6, Math.min(Math.max(py(0) + 13, 12), h - 4));
        }
        for (var gy = Math.ceil(view.y0 / sy) * sy; gy <= view.y1; gy += sy) {
          ctx.beginPath(); ctx.moveTo(px(view.x0), py(gy)); ctx.lineTo(px(view.x1), py(gy)); ctx.stroke();
          if (Math.abs(gy) > 1e-9) ctx.fillText(+gy.toFixed(2), Math.min(Math.max(px(0) + 4, 2), w - 30), py(gy) - 2);
        }
        ctx.strokeStyle = '#151820'; ctx.lineWidth = 1.4;
        if (view.y0 < 0 && view.y1 > 0) { ctx.beginPath(); ctx.moveTo(px(view.x0), py(0)); ctx.lineTo(px(view.x1), py(0)); ctx.stroke(); }
        if (view.x0 < 0 && view.x1 > 0) { ctx.beginPath(); ctx.moveTo(px(0), py(view.y0)); ctx.lineTo(px(0), py(view.y1)); ctx.stroke(); }
      },
      fn: function (f, color, width, dash, breaks) {
        ctx.save(); ctx.beginPath(); ctx.rect(pad, pad, w - 2 * pad, h - 2 * pad); ctx.clip();
        ctx.strokeStyle = color; ctx.lineWidth = width || 3; ctx.setLineDash(dash || []);
        var N = 900, pen = false, prev = null, big = (view.y1 - view.y0) * 3;
        ctx.beginPath();
        for (var i = 0; i <= N; i++) {
          var x = view.x0 + (view.x1 - view.x0) * i / N, y = f(x);
          var cross = prev !== null && (breaks || []).some(function (b) { return (prev - b) * (x - b) <= 0; });
          if (!isFinite(y) || cross) { pen = false; prev = x; if (!isFinite(y)) continue; }
          y = Math.max(Math.min(y, view.y1 + big), view.y0 - big);
          if (pen) ctx.lineTo(px(x), py(y)); else ctx.moveTo(px(x), py(y));
          pen = true; prev = x;
        }
        ctx.stroke(); ctx.restore();
      },
      vline: function (a, color) {
        ctx.save(); ctx.setLineDash([7, 6]); ctx.strokeStyle = color || '#c62828'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px(a), py(view.y0)); ctx.lineTo(px(a), py(view.y1)); ctx.stroke(); ctx.restore();
      },
      dot: function (x, y, color, hollow, r) {
        ctx.save(); ctx.beginPath(); ctx.arc(px(x), py(y), r || 6, 0, 2 * Math.PI);
        if (hollow) { ctx.fillStyle = 'white'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke(); }
        else { ctx.fillStyle = color; ctx.fill(); }
        ctx.restore();
      },
      label: function (text, x, y, color) { ctx.save(); ctx.fillStyle = color || '#151820'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.fillText(text, px(x), py(y)); ctx.restore(); }
    };
    return api;
  }

  // ---------- Теория: первый замечательный предел ----------
  function initRemarkable() {
    var c1 = document.getElementById('rem-canvas'), slider = document.getElementById('rem-slider');
    if (!c1 || !slider) return;
    var c2 = document.getElementById('sinx-canvas'), c3 = document.getElementById('circle-canvas');
    var out = document.getElementById('rem-x'), text = document.getElementById('rem-text');
    var p1 = makePlot(c1, { x0: -10, x1: 10, y0: -0.5, y1: 1.4, stepX: 2, stepY: 0.5 });
    var p2 = makePlot(c2, { x0: -2.2, x1: 2.2, y0: -1.6, y1: 1.6, stepX: 0.5, stepY: 0.5 });
    var sinc = function (x) { return Math.abs(x) < 1e-9 ? NaN : Math.sin(x) / x; };

    function draw() {
      var x = slider.value / 100; if (x === 0) x = 0.01;
      out.textContent = x.toFixed(2);
      // график sin x / x
      p1.begin();
      p1.fn(function () { return 1; }, '#c62828', 1.5, [6, 6]);
      p1.fn(sinc, '#1f4e79', 3);
      p1.dot(0, 1, '#1f4e79', true);
      p1.label('y = 1', 6.8, 1.08, '#c62828');
      p1.dot(x, sinc(x), '#f1c232', false, 7);
      p1.ctx.font = '22px system-ui'; p1.ctx.fillText('🏎️', p1.px(x) - 12, p1.py(sinc(x)) - 10);
      text.textContent = 'x = ' + x.toFixed(2) + ':  sin x / x = ' + sinc(x).toFixed(4) +
        (Math.abs(x) <= 0.3 ? ' — почти 1!' : '. Подвинь ползунок ближе к нулю.');
      // sin x и x
      p2.begin();
      p2.fn(function (t) { return t; }, '#8a8f99', 2, [6, 5]);
      p2.fn(Math.sin, '#c62828', 3);
      p2.label('y = x', 1.15, 1.45, '#606775'); p2.label('y = sin x', 1.2, 0.72, '#c62828');
      var xs = Math.max(-2.2, Math.min(2.2, x));
      p2.ctx.save(); p2.ctx.strokeStyle = '#1f4e79'; p2.ctx.lineWidth = 2;
      p2.ctx.beginPath(); p2.ctx.moveTo(p2.px(xs), p2.py(Math.sin(xs))); p2.ctx.lineTo(p2.px(xs), p2.py(xs)); p2.ctx.stroke(); p2.ctx.restore();
      p2.dot(xs, Math.sin(xs), '#c62828', false, 5); p2.dot(xs, xs, '#606775', false, 5);
      // единичная окружность
      drawCircle(Math.max(Math.min(Math.abs(x), 1.05), 0.02));
    }
    function drawCircle(a) {
      var ctx = c3.getContext('2d'), dpr = window.devicePixelRatio || 1, w = c3.clientWidth, h = c3.clientHeight;
      c3.width = w * dpr; c3.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      var R = Math.min(w * 0.45, h * 0.5), ox = w * 0.12, oy = h * 0.9;
      function X(u) { return ox + u * R; } function Y(v) { return oy - v * R; }
      var tg = Math.tan(a);
      ctx.lineWidth = 1.3; ctx.strokeStyle = '#151820';
      ctx.beginPath(); ctx.moveTo(X(-0.1), Y(0)); ctx.lineTo(X(1.45), Y(0)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(0), Y(-0.1)); ctx.lineTo(X(0), Y(1.9)); ctx.stroke();
      ctx.strokeStyle = '#c9c2b4'; ctx.beginPath(); ctx.arc(X(0), Y(0), R, -Math.PI / 2 - 0.05, 0.05); ctx.stroke();
      // сектор
      ctx.fillStyle = '#1f4e7922'; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.arc(X(0), Y(0), R, -a, 0); ctx.closePath(); ctx.fill();
      // большой треугольник
      ctx.strokeStyle = '#2e7d32'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(1), Y(0)); ctx.lineTo(X(1), Y(tg)); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(tg)); ctx.stroke();
      // дуга x
      ctx.strokeStyle = '#1f4e79'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(X(0), Y(0), R, -a, 0); ctx.stroke();
      // sin x
      ctx.strokeStyle = '#c62828'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(Math.cos(a)), Y(0)); ctx.lineTo(X(Math.cos(a)), Y(Math.sin(a))); ctx.stroke();
      ctx.strokeStyle = '#151820'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(Math.cos(a)), Y(Math.sin(a))); ctx.stroke();
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#151820'; ctx.fillText('O', X(0) - 14, Y(0) + 14); ctx.fillText('1', X(1) - 4, Y(0) + 16);
      // легенда в левом верхнем углу
      var lx = (w - X(1) > 130) ? X(1) + 12 : 8, ly = (w - X(1) > 130) ? Y(1.3) : 18;
      ctx.fillStyle = '#151820'; ctx.fillText('угол x = ' + a.toFixed(2) + ' рад', lx, ly);
      ctx.fillStyle = '#c62828'; ctx.fillText('sin x = ' + Math.sin(a).toFixed(3), lx, ly + 18);
      ctx.fillStyle = '#1f4e79'; ctx.fillText('дуга = x = ' + a.toFixed(3), lx, ly + 36);
      ctx.fillStyle = '#2e7d32'; ctx.fillText('tg x = ' + Math.tan(a).toFixed(3), lx, ly + 54);
      ctx.fillStyle = '#151820'; ctx.fillText('sin x / x = ' + (Math.sin(a) / a).toFixed(4), lx, ly + 76);
    }
    slider.addEventListener('input', draw);
    window.addEventListener('resize', draw);
    draw();
  }

  // ---------- Теория: асимптоты ----------
  var ASY = [
    { id: '11837', tex: 'y=\\frac{x^2-4}{x+1}', f: function (x) { return (x * x - 4) / (x + 1); }, view: { x0: -8, x1: 8, y0: -10, y1: 10 },
      v: [-1], lines: [{ k: 1, b: -1, name: 'y = x − 1' }],
      text: '<p><b>Вертикальная \\(x=-1\\):</b> знаменатель \\(x+1\\to0\\), а числитель \\(\\to-3\\). Слева от \\(-1\\) график улетает вверх \\((+\\infty)\\), справа — вниз \\((-\\infty)\\).</p><p><b>Наклонная \\(y=x-1\\):</b> выделим целую часть: \\(\\frac{x^2-4}{x+1}=x-1-\\frac{3}{x+1}\\). Дробь \\(\\frac{3}{x+1}\\to0\\), поэтому далеко график почти совпадает с прямой \\(y=x-1\\).</p><p><b>Горизонтальной нет:</b> \\(y\\to\\infty\\) при \\(x\\to\\infty\\).</p>' },
    { id: '11838', tex: 'y=\\frac{x^2}{x^2-1}', f: function (x) { return x * x / (x * x - 1); }, view: { x0: -6, x1: 6, y0: -4, y1: 5 },
      v: [-1, 1], lines: [{ k: 0, b: 1, name: 'y = 1' }],
      text: '<p><b>Вертикальные \\(x=\\pm1\\):</b> там знаменатель равен нулю, а числитель равен 1.</p><p><b>Горизонтальная \\(y=1\\):</b> \\(\\frac{x^2}{x^2-1}=1+\\frac{1}{x^2-1}\\), а \\(\\frac{1}{x^2-1}\\to0\\) при \\(x\\to\\pm\\infty\\). График прижимается к прямой \\(y=1\\) сверху.</p>' },
    { id: '11840', tex: 'y=\\frac{x^3}{4-x^2}', f: function (x) { return x * x * x / (4 - x * x); }, view: { x0: -8, x1: 8, y0: -12, y1: 12 },
      v: [-2, 2], lines: [{ k: -1, b: 0, name: 'y = −x' }],
      text: '<p><b>Вертикальные \\(x=\\pm2\\):</b> \\(4-x^2=0\\), числитель там \\(\\pm8\\ne0\\).</p><p><b>Наклонная \\(y=-x\\):</b> \\(\\frac{x^3}{4-x^2}=-x+\\frac{4x}{4-x^2}\\), и \\(\\frac{4x}{4-x^2}\\to0\\). Значит, \\(k=-1\\), \\(b=0\\).</p>' },
    { id: '11835', tex: 'y=2^{\\frac1x}', f: function (x) { return Math.abs(x) < 1e-9 ? NaN : Math.pow(2, 1 / x); }, view: { x0: -6, x1: 6, y0: -1, y1: 6 },
      v: [0], lines: [{ k: 0, b: 1, name: 'y = 1' }],
      text: '<p><b>Вертикальная \\(x=0\\) — только справа:</b> \\(\\lim\\limits_{x\\to0+0}2^{\\frac1x}=+\\infty\\), а слева \\(\\lim\\limits_{x\\to0-0}2^{\\frac1x}=0\\) — график подходит к началу координат.</p><p><b>Горизонтальная \\(y=1\\):</b> при \\(x\\to\\pm\\infty\\) показатель \\(\\frac1x\\to0\\), а \\(2^0=1\\).</p>' },
    { id: '11827', tex: 'y=\\frac{1}{x^2+1}', f: function (x) { return 1 / (x * x + 1); }, view: { x0: -6, x1: 6, y0: -0.5, y1: 1.5 },
      v: [], lines: [{ k: 0, b: 0, name: 'y = 0' }],
      text: '<p><b>Вертикальных нет:</b> \\(x^2+1\\ge1\\), знаменатель никогда не равен нулю.</p><p><b>Горизонтальная \\(y=0\\):</b> \\(\\lim\\limits_{x\\to\\pm\\infty}\\frac{1}{x^2+1}=0\\). График — «холмик», хвосты которого прижимаются к оси \\(Ox\\).</p>' }
  ];

  function initAsymptotes() {
    var canvas = document.getElementById('asy-canvas'); if (!canvas) return;
    var box = document.getElementById('asy-buttons'), exp = document.getElementById('asy-explain');
    var slider = document.getElementById('asy-slider'), out = document.getElementById('asy-x'), text = document.getElementById('asy-text');
    var cur = ASY[0], plot;
    box.innerHTML = ASY.map(function (a, i) { return '<button type="button" data-i="' + i + '">№ ' + a.id + ': \\(' + a.tex + '\\)</button>'; }).join('');
    typeset(box);
    function select(i) {
      cur = ASY[i]; plot = makePlot(canvas, cur.view);
      box.querySelectorAll('button').forEach(function (b, j) { b.classList.toggle('on', j === i); });
      exp.innerHTML = '<h3>№ ' + cur.id + ': \\(' + cur.tex + '\\)</h3>' + cur.text;
      typeset(exp); draw();
    }
    function draw() {
      var v = cur.view, x = v.x0 + (v.x1 - v.x0) * (+slider.value + 1000) / 2000;
      if (cur.v.some(function (a) { return Math.abs(x - a) < 1e-6; })) x += 0.01;
      out.textContent = x.toFixed(2);
      plot.begin();
      cur.v.forEach(function (a) { plot.vline(a); plot.label('x = ' + a, a + 0.15, v.y1 - (v.y1 - v.y0) * 0.06, '#c62828'); });
      cur.lines.forEach(function (l) {
        plot.fn(function (t) { return l.k * t + l.b; }, '#c62828', 2, [7, 6]);
        var lx = v.x1 - (v.x1 - v.x0) * 0.25; plot.label(l.name, lx, Math.min(l.k * lx + l.b, v.y1 * 0.9) + (v.y1 - v.y0) * 0.04, '#c62828');
      });
      plot.fn(cur.f, '#1f4e79', 3, null, cur.v);
      var y = cur.f(x);
      if (isFinite(y)) { plot.dot(x, Math.max(Math.min(y, v.y1), v.y0), '#f1c232', false, 7); }
      var l = cur.lines[0], ya = l.k * x + l.b;
      text.textContent = 'f(' + x.toFixed(2) + ') = ' + (isFinite(y) ? y.toFixed(3) : '—') + ';  на асимптоте ' + l.name.split(' = ')[0] + ' = ' + ya.toFixed(3) +
        ';  разница = ' + (isFinite(y) ? Math.abs(y - ya).toFixed(3) : '—') + '. Уведи x подальше — разница уменьшается.';
    }
    box.addEventListener('click', function (e) { var b = e.target.closest('button[data-i]'); if (b) select(+b.dataset.i); });
    slider.addEventListener('input', draw);
    window.addEventListener('resize', function () { draw(); });
    select(0);
  }

  function initCounts() {
    if (!window.TASKS) return;
    document.querySelectorAll('[data-goal-count]').forEach(function (el) {
      var g = el.getAttribute('data-goal-count');
      el.textContent = window.TASKS.filter(function (t) { return t.goal === g; }).length;
    });
    document.querySelectorAll('[data-total-count]').forEach(function (el) { el.textContent = window.TASKS.length; });
  }

  // экспорт для тестов
  window.RaceLimits = { checkAnswer: checkAnswer, parseNumber: parseNumber, answerTex: answerTex };

  initTrainer();
  initSheet();
  initHole();
  initRemarkable();
  initAsymptotes();
  initCounts();
})();
