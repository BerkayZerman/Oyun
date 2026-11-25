(() => {
  'use strict';

  const GRID_SIZE = 20;
  const CELL_SIZE = 20;
  const TICK_MS = 120;
  const MAX_FRAME_MS = 250;
  const STORAGE_KEY = 'snakeHighScore';
  const SOUND_STORAGE_KEY = 'snakeSoundEnabled';
  const SPRITE_SIZE = 24;
  const SPRITE_CENTER = SPRITE_SIZE / 2;
  const SPRITE_HALF = SPRITE_CENTER;
  const TAU = Math.PI * 2;

  const DIRECTIONS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 }
  };

  const KEY_MAP = {
    ArrowUp: 'UP', KeyW: 'UP',
    ArrowDown: 'DOWN', KeyS: 'DOWN',
    ArrowLeft: 'LEFT', KeyA: 'LEFT',
    ArrowRight: 'RIGHT', KeyD: 'RIGHT'
  };

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('highScore');
  const statusEl = document.getElementById('status');
  const overlay = document.getElementById('overlay');
  const overlayKicker = document.getElementById('overlayKicker');
  const overlayTitle = document.getElementById('overlayTitle');
  const finalScore = document.getElementById('finalScore');
  const restartBtn = document.getElementById('restartBtn');
  const pauseScreen = document.getElementById('pauseScreen');
  const pauseBtn = document.getElementById('pauseBtn');
  const soundBtn = document.getElementById('soundBtn');
  const dpadButtons = document.querySelectorAll('.dpad-btn');

  let snake = [];
  let direction = DIRECTIONS.RIGHT;
  let pendingDirections = [];
  let food = null;
  let score = 0;
  let highScore = 0;
  let gameOver = false;
  let won = false;
  let paused = false;
  let hasStarted = false;
  let accumulator = 0;
  let lastTime = null;
  let eatPulse = -1000;
  let soundEnabled = true;
  let audioContext = null;
  let backgroundLayer = null;
  let bodySprite = null;
  let headSprite = null;

  function loadHighScore() {
    try {
      const stored = Number.parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10);
      return Number.isFinite(stored) && stored > 0 ? stored : 0;
    } catch {
      return 0;
    }
  }

  function saveHighScore() {
    try {
      localStorage.setItem(STORAGE_KEY, String(highScore));
    } catch {
      // Depolama kapalıysa oyun yine de çalışır.
    }
  }

  function loadSoundPreference() {
    try {
      return localStorage.getItem(SOUND_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  }

  function saveSoundPreference() {
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, String(soundEnabled));
    } catch {
      // Ses tercihi kaydedilemezse oturum içinde çalışmaya devam eder.
    }
  }

  function ensureAudio() {
    if (!soundEnabled) return null;
    try {
      if (!audioContext) {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return null;
        audioContext = new AudioCtor();
      }
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }
      return audioContext;
    } catch {
      return null;
    }
  }

  function playTone(startFreq, endFreq, duration, type, volume) {
    const audio = ensureAudio();
    if (!audio) return;

    try {
      const start = audio.currentTime;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(startFreq, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), start + duration);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    } catch {
      // Tarayıcı sesi engellerse oyun sessiz devam eder.
    }
  }

  function playEatSound() {
    playTone(620, 1050, 0.13, 'triangle', 0.07);
  }

  function playCrashSound() {
    playTone(240, 60, 0.32, 'sawtooth', 0.06);
  }

  function updateStatus() {
    let text = 'HAZIR';
    let state = 'ready';

    if (gameOver) {
      text = won ? 'KAZANDIN' : 'OYUN BİTTİ';
      state = won ? 'win' : 'over';
    } else if (paused) {
      text = 'DURAKLATILDI';
      state = 'paused';
    } else if (hasStarted) {
      text = 'OYUNDA';
      state = 'playing';
    }

    statusEl.textContent = text;
    statusEl.dataset.state = state;
  }

  function updateHUD() {
    scoreEl.textContent = String(score);
    highScoreEl.textContent = String(highScore);
    updateStatus();
  }

  function updateSoundButton() {
    soundBtn.setAttribute('aria-pressed', String(soundEnabled));
    soundBtn.classList.toggle('is-muted', !soundEnabled);
    soundBtn.textContent = soundEnabled ? 'Ses Açık' : 'Ses Kapalı';
  }

  function resetPauseButton() {
    pauseBtn.setAttribute('aria-pressed', 'false');
    pauseBtn.classList.remove('is-active');
    pauseBtn.textContent = 'II Duraklat';
  }

  function pseudoRandom(x, y) {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function createBackground() {
    const layer = document.createElement('canvas');
    layer.width = canvas.width;
    layer.height = canvas.height;
    const b = layer.getContext('2d');

    b.fillStyle = '#06110c';
    b.fillRect(0, 0, layer.width, layer.height);

    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const noise = pseudoRandom(x, y);
        b.fillStyle = `rgba(30, 96, 62, ${0.05 + noise * 0.07})`;
        b.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);

        if (noise > 0.82) {
          b.fillStyle = 'rgba(140, 255, 190, 0.07)';
          b.fillRect(x * CELL_SIZE + 4 + Math.floor(noise * 6), y * CELL_SIZE + 5, 1, 1);
        }
      }
    }

    b.lineWidth = 1;
    b.strokeStyle = 'rgba(125, 255, 184, 0.07)';
    for (let i = 1; i < GRID_SIZE; i += 1) {
      const position = i * CELL_SIZE + 0.5;
      b.beginPath();
      b.moveTo(position, 0);
      b.lineTo(position, layer.height);
      b.stroke();
      b.beginPath();
      b.moveTo(0, position);
      b.lineTo(layer.width, position);
      b.stroke();
    }

    b.strokeStyle = 'rgba(125, 255, 184, 0.12)';
    b.strokeRect(0.5, 0.5, layer.width - 1, layer.height - 1);

    const vignette = b.createRadialGradient(
      layer.width / 2, layer.height / 2, layer.width * 0.18,
      layer.width / 2, layer.height / 2, layer.width * 0.72
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    b.fillStyle = vignette;
    b.fillRect(0, 0, layer.width, layer.height);

    return layer;
  }

  function createBodySprite() {
    const sprite = document.createElement('canvas');
    sprite.width = SPRITE_SIZE;
    sprite.height = SPRITE_SIZE;
    const s = sprite.getContext('2d');
    const c = SPRITE_CENTER;

    s.shadowColor = 'rgba(0, 0, 0, 0.65)';
    s.shadowBlur = 4;
    s.shadowOffsetY = 2;

    const gradient = s.createRadialGradient(c - 3, c - 4, 1, c, c, 9);
    gradient.addColorStop(0, '#b8ffd8');
    gradient.addColorStop(0.35, '#48e8a0');
    gradient.addColorStop(0.75, '#17a86c');
    gradient.addColorStop(1, '#075739');

    s.fillStyle = gradient;
    s.beginPath();
    s.arc(c, c, 9, 0, TAU);
    s.fill();

    s.shadowColor = 'transparent';
    s.strokeStyle = 'rgba(4, 60, 38, 0.35)';
    s.lineWidth = 1;
    for (const offset of [-4, 0, 4]) {
      s.beginPath();
      s.arc(c + offset, c, 6.5, -0.9, 0.9);
      s.stroke();
    }

    s.strokeStyle = 'rgba(230, 255, 240, 0.22)';
    s.beginPath();
    s.arc(c - 1, c - 2, 6, 3.5, 5.2);
    s.stroke();

    return sprite;
  }

  function createHeadSprite() {
    const sprite = document.createElement('canvas');
    sprite.width = SPRITE_SIZE;
    sprite.height = SPRITE_SIZE;
    const s = sprite.getContext('2d');
    const c = SPRITE_CENTER;

    const gradient = s.createRadialGradient(c - 3, c - 4, 1, c, c, 10);
    gradient.addColorStop(0, '#dcffe9');
    gradient.addColorStop(0.4, '#6dffb0');
    gradient.addColorStop(0.8, '#1cb978');
    gradient.addColorStop(1, '#075739');

    s.fillStyle = gradient;
    s.beginPath();
    s.arc(c, c, 9.8, 0, TAU);
    s.fill();

    s.strokeStyle = 'rgba(230, 255, 240, 0.5)';
    s.lineWidth = 1;
    s.stroke();

    return sprite;
  }

  function cellCenter(segment) {
    return {
      x: segment.x * CELL_SIZE + CELL_SIZE / 2,
      y: segment.y * CELL_SIZE + CELL_SIZE / 2
    };
  }

  function placeFood() {
    const freeCells = [];
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const occupied = snake.some((segment) => segment.x === x && segment.y === y);
        if (!occupied) freeCells.push({ x, y });
      }
    }

    if (freeCells.length === 0) {
      won = true;
      endGame('Tebrikler!');
      return;
    }

    const index = Math.floor(Math.random() * freeCells.length);
    food = freeCells[index];
  }

  function reset() {
    snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 }
    ];
    direction = DIRECTIONS.RIGHT;
    pendingDirections = [];
    food = null;
    score = 0;
    gameOver = false;
    won = false;
    paused = false;
    hasStarted = false;
    accumulator = 0;
    lastTime = performance.now();
    eatPulse = -1000;

    overlay.hidden = true;
    pauseScreen.hidden = true;
    resetPauseButton();
    placeFood();
    updateHUD();
    draw(performance.now());
    canvas.focus({ preventScroll: true });
  }

  function isOpposite(a, b) {
    return a.x === -b.x && a.y === -b.y;
  }

  function queueDirection(name) {
    if (gameOver || paused) return;

    const next = DIRECTIONS[name];
    const lastQueued = pendingDirections.length > 0
      ? pendingDirections[pendingDirections.length - 1]
      : direction;

    if (next.x === lastQueued.x && next.y === lastQueued.y) return;
    if (isOpposite(next, lastQueued)) return;
    if (pendingDirections.length >= 2) return;

    pendingDirections.push(next);
  }

  function togglePause() {
    if (gameOver) return;

    paused = !paused;
    pauseScreen.hidden = !paused;
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.classList.toggle('is-active', paused);
    pauseBtn.textContent = paused ? '▶ Devam Et' : 'II Duraklat';

    if (!paused) {
      accumulator = 0;
      lastTime = performance.now();
      canvas.focus({ preventScroll: true });
    }

    updateStatus();
  }

  function endGame(title) {
    gameOver = true;
    paused = false;
    pendingDirections = [];
    pauseScreen.hidden = true;
    resetPauseButton();

    if (!won) playCrashSound();

    if (score > highScore) {
      highScore = score;
      saveHighScore();
    }
    updateHUD();

    overlayKicker.textContent = won ? 'PERFECT CLEAR' : 'GAME OVER';
    overlayTitle.textContent = title;
    finalScore.textContent = String(score);
    overlay.hidden = false;
    restartBtn.focus({ preventScroll: true });
  }

  function step() {
    if (!hasStarted) {
      hasStarted = true;
      updateStatus();
    }

    if (pendingDirections.length > 0) {
      direction = pendingDirections.shift();
    }

    const head = snake[0];
    const nextHead = {
      x: head.x + direction.x,
      y: head.y + direction.y
    };

    const outOfBounds = nextHead.x < 0 || nextHead.x >= GRID_SIZE ||
      nextHead.y < 0 || nextHead.y >= GRID_SIZE;
    if (outOfBounds) {
      endGame('Oyun Bitti');
      return;
    }

    const eating = food !== null && nextHead.x === food.x && nextHead.y === food.y;
    const bodyToCheck = eating ? snake : snake.slice(0, -1);
    const hitBody = bodyToCheck.some((segment) => segment.x === nextHead.x && segment.y === nextHead.y);
    if (hitBody) {
      endGame('Oyun Bitti');
      return;
    }

    snake.unshift(nextHead);

    if (eating) {
      score += 1;
      eatPulse = performance.now();
      playEatSound();
      if (score > highScore) {
        highScore = score;
        saveHighScore();
      }
      updateHUD();
      placeFood();
      if (gameOver) return;
    } else {
      snake.pop();
    }

    draw(performance.now());
  }

  function drawFood(now) {
    const center = cellCenter(food);
    const x = center.x;
    const y = center.y;
    const pulse = 0.5 + 0.5 * Math.sin(now / 260);

    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x + 1, y + 7, 6.5, 2.5, 0, 0, TAU);
    ctx.fill();

    ctx.shadowColor = 'rgba(255, 90, 80, 0.9)';
    ctx.shadowBlur = 10 + pulse * 6;

    const gradient = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, 9);
    gradient.addColorStop(0, '#ffd6c2');
    gradient.addColorStop(0.35, '#ff6b5e');
    gradient.addColorStop(1, '#a81f22');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y + 1, 7.2, 0, TAU);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#6b3f1d';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.quadraticCurveTo(x + 3, y - 9, x + 5, y - 8);
    ctx.stroke();

    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(x + 4, y - 9, 3.2, 1.6, -0.5, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.ellipse(x - 2.5, y - 2.5, 1.8, 1.1, -0.6, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  function drawEyes(head, now) {
    const center = cellCenter(head);
    const perpendicular = { x: -direction.y, y: direction.x };

    for (const side of [-1, 1]) {
      const eyeX = center.x + direction.x * 3.5 + perpendicular.x * 4.2 * side;
      const eyeY = center.y + direction.y * 3.5 + perpendicular.y * 4.2 * side;

      ctx.fillStyle = '#f4fff8';
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, 2.6, 0, TAU);
      ctx.fill();

      ctx.fillStyle = '#061a10';
      ctx.beginPath();
      ctx.arc(eyeX + direction.x * 0.8, eyeY + direction.y * 0.8, 1.4, 0, TAU);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(eyeX - 0.6, eyeY - 0.8, 0.6, 0, TAU);
      ctx.fill();
    }

    const flick = 2.5 + Math.sin(now / 140) * 1.2;
    const tipX = center.x + direction.x * (9 + flick);
    const tipY = center.y + direction.y * (9 + flick);

    ctx.save();
    ctx.strokeStyle = '#ff6b81';
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(center.x + direction.x * 8, center.y + direction.y * 8);
    ctx.lineTo(tipX, tipY);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + perpendicular.x * 2.2, tipY + perpendicular.y * 2.2);
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - perpendicular.x * 2.2, tipY - perpendicular.y * 2.2);
    ctx.stroke();
    ctx.restore();
  }

  function drawSnake(now) {
    ctx.save();
    ctx.strokeStyle = '#0a6b45';
    ctx.lineWidth = CELL_SIZE - 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;

    for (let i = snake.length - 1; i > 0; i -= 1) {
      const from = cellCenter(snake[i]);
      const to = cellCenter(snake[i - 1]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.restore();

    for (let i = snake.length - 1; i >= 1; i -= 1) {
      const segment = cellCenter(snake[i]);
      ctx.drawImage(bodySprite, segment.x - SPRITE_HALF, segment.y - SPRITE_HALF);
    }

    const head = cellCenter(snake[0]);
    const glow = Math.max(0, 1 - (now - eatPulse) / 380);

    if (glow > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(150, 255, 200, ${glow * 0.7})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(head.x, head.y, 11 + (1 - glow) * 6, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = 'rgba(90, 255, 175, 0.9)';
    ctx.shadowBlur = 11 + glow * 16;
    ctx.drawImage(headSprite, head.x - SPRITE_HALF, head.y - SPRITE_HALF);
    ctx.restore();

    drawEyes(snake[0], now);
  }

  function draw(timestamp) {
    const now = typeof timestamp === 'number' ? timestamp : performance.now();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(backgroundLayer, 0, 0);

    if (food) drawFood(now);
    if (snake.length > 0) drawSnake(now);
  }

  function handleKey(event) {
    const isEnterOrSpace = event.code === 'Enter' || event.code === 'Space';
    if (isEnterOrSpace && event.target instanceof HTMLButtonElement) return;

    const directionName = KEY_MAP[event.code];
    if (directionName) {
      event.preventDefault();
      ensureAudio();
      queueDirection(directionName);
      return;
    }

    if (event.code === 'KeyP') {
      event.preventDefault();
      if (!event.repeat) togglePause();
      return;
    }

    if (isEnterOrSpace) {
      event.preventDefault();
      if (!event.repeat && gameOver) {
        ensureAudio();
        reset();
      }
    }
  }

  function bindControls() {
    window.addEventListener('keydown', handleKey);

    restartBtn.addEventListener('click', () => reset());
    pauseBtn.addEventListener('click', () => togglePause());

    soundBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      saveSoundPreference();
      updateSoundButton();
      if (soundEnabled) playTone(880, 660, 0.08, 'sine', 0.05);
    });

    dpadButtons.forEach((button) => {
      const name = button.dataset.direction;

      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        ensureAudio();
        queueDirection(name);
        button.classList.add('is-pressed');
      });

      const release = () => button.classList.remove('is-pressed');
      button.addEventListener('pointerup', release);
      button.addEventListener('pointerleave', release);
      button.addEventListener('pointercancel', release);

      button.addEventListener('click', (event) => {
        if (event.detail === 0) {
          ensureAudio();
          queueDirection(name);
        }
      });
    });
  }

  function loop(timestamp) {
    if (lastTime === null) lastTime = timestamp;
    const delta = Math.min(timestamp - lastTime, MAX_FRAME_MS);
    lastTime = timestamp;

    if (!gameOver && !paused) {
      accumulator += delta;
      while (accumulator >= TICK_MS && !gameOver && !paused) {
        step();
        accumulator -= TICK_MS;
      }
    }

    draw(timestamp);
    requestAnimationFrame(loop);
  }

  function init() {
    highScore = loadHighScore();
    soundEnabled = loadSoundPreference();
    backgroundLayer = createBackground();
    bodySprite = createBodySprite();
    headSprite = createHeadSprite();

    updateSoundButton();
    reset();
    bindControls();

    requestAnimationFrame(loop);
  }

  init();
})();
