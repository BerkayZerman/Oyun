(() => {
  'use strict';

  const GRID_SIZE = 20;
  const CELL_SIZE = 20;
  const TICK_MS = 120;
  const MAX_FRAME_MS = 250;
  const STORAGE_KEY = 'snakeHighScore';

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
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const finalScore = document.getElementById('finalScore');
  const restartBtn = document.getElementById('restartBtn');

  let snake = [];
  let direction = DIRECTIONS.RIGHT;
  let pendingDirections = [];
  let food = null;
  let score = 0;
  let highScore = 0;
  let gameOver = false;
  let won = false;
  let accumulator = 0;
  let lastTime = null;

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

  function updateHUD() {
    scoreEl.textContent = String(score);
    highScoreEl.textContent = String(highScore);
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
    accumulator = 0;
    lastTime = performance.now();

    overlay.hidden = true;
    placeFood();
    updateHUD();
    draw();
    canvas.focus({ preventScroll: true });
  }

  function isOpposite(a, b) {
    return a.x === -b.x && a.y === -b.y;
  }

  function queueDirection(name) {
    if (gameOver) return;

    const next = DIRECTIONS[name];
    const lastQueued = pendingDirections.length > 0
      ? pendingDirections[pendingDirections.length - 1]
      : direction;

    if (next.x === lastQueued.x && next.y === lastQueued.y) return;
    if (isOpposite(next, lastQueued)) return;
    if (pendingDirections.length >= 2) return;

    pendingDirections.push(next);
  }

  function endGame(title) {
    gameOver = true;
    pendingDirections = [];

    if (score > highScore) {
      highScore = score;
      saveHighScore();
    }
    updateHUD();

    overlayTitle.textContent = title;
    finalScore.textContent = String(score);
    overlay.hidden = false;
    restartBtn.focus({ preventScroll: true });
  }

  function step() {
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

    draw();
  }

  function roundedRectPath(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function drawEyes(head) {
    const centerX = head.x * CELL_SIZE + CELL_SIZE / 2;
    const centerY = head.y * CELL_SIZE + CELL_SIZE / 2;
    const perpendicular = { x: -direction.y, y: direction.x };

    for (const side of [-1, 1]) {
      const eyeX = centerX + direction.x * 3 + perpendicular.x * 4 * side;
      const eyeY = centerY + direction.y * 3 + perpendicular.y * 4 * side;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = '#064e3b';
      ctx.fill();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID_SIZE; i += 1) {
      const position = i * CELL_SIZE + 0.5;
      ctx.beginPath();
      ctx.moveTo(position, 0);
      ctx.lineTo(position, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, position);
      ctx.lineTo(canvas.width, position);
      ctx.stroke();
    }

    if (food) {
      ctx.save();
      ctx.fillStyle = '#f87171';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 12;
      roundedRectPath(ctx, food.x * CELL_SIZE + 3, food.y * CELL_SIZE + 3, CELL_SIZE - 6, CELL_SIZE - 6, 6);
      ctx.fill();
      ctx.restore();
    }

    for (let i = snake.length - 1; i >= 0; i -= 1) {
      const segment = snake[i];
      const isHead = i === 0;

      ctx.save();
      ctx.fillStyle = isHead ? '#6ee7b7' : '#10b981';
      ctx.shadowColor = isHead ? '#34d399' : 'transparent';
      ctx.shadowBlur = isHead ? 10 : 0;
      roundedRectPath(ctx, segment.x * CELL_SIZE + 2, segment.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4, 5);
      ctx.fill();
      ctx.restore();
    }

    if (snake.length > 0) {
      drawEyes(snake[0]);
    }
  }

  function handleKey(event) {
    const directionName = KEY_MAP[event.code];
    if (directionName) {
      event.preventDefault();
      queueDirection(directionName);
      return;
    }

    if (event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault();
      if (gameOver) reset();
    }
  }

  function loop(timestamp) {
    if (lastTime === null) lastTime = timestamp;
    const delta = Math.min(timestamp - lastTime, MAX_FRAME_MS);
    lastTime = timestamp;

    if (!gameOver) {
      accumulator += delta;
      while (accumulator >= TICK_MS && !gameOver) {
        step();
        accumulator -= TICK_MS;
      }
    }

    draw();
    requestAnimationFrame(loop);
  }

  function init() {
    highScore = loadHighScore();
    reset();

    window.addEventListener('keydown', handleKey);
    restartBtn.addEventListener('click', () => reset());

    requestAnimationFrame(loop);
  }

  init();
})();
