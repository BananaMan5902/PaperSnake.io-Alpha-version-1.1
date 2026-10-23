"use strict";

// ============================================================
// PAPER SNAKE — GitHub Pages version
// ============================================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const mini = document.getElementById("minimap");
const mctx = mini.getContext("2d");

const WORLD_SIZE = 12000;
const CELL_SIZE = 40;
const GRID = WORLD_SIZE / CELL_SIZE;
const TOTAL_CELLS = GRID * GRID;

const PLAYER_ID = 1;
const CPU_COUNT = 10;

const COLORS = {
  0: "#78945b",
  1: "#ffe34d",
  2: "#ef6262",
  3: "#58a6ff",
  4: "#c17aff",
  5: "#ff9d45",
  6: "#47ded0",
  7: "#ed78b8",
  8: "#a8dc57",
  9: "#f2f2f2",
  10: "#e9a6ff",
  11: "#7bd69a"
};

let territory = new Uint8Array(TOTAL_CELLS);
let trailGrid = new Int16Array(TOTAL_CELLS);
trailGrid.fill(-1);

let snakes = [];
let player;
let nextSnakeId = 2;

let keys = {};
let gameOver = false;
let victory = false;
let lastTime = 0;
let moveAccumulator = 0;
let noticeTimer = 0;
let noticeText = "";

let viewWidth = window.innerWidth;
let viewHeight = window.innerHeight;

const camera = { x: 0, y: 0 };

const directions = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 }
];

function cellIndex(x, y) {
  return y * GRID + x;
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < GRID && y < GRID;
}

function sameCell(a, b) {
  return a.x === b.x && a.y === b.y;
}

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function randomDirection() {
  return randomInt(4);
}

function cellOccupied(x, y) {
  for (const snake of snakes) {
    for (const segment of snake.body) {
      if (segment.x === x && segment.y === y) return true;
    }

    for (const cell of snake.trail) {
      if (cell.x === x && cell.y === y) return true;
    }
  }

  return false;
}

// ============================================================
// FIND OPEN LAND
// ============================================================

function findOpenLand(avoidX = -1000, avoidY = -1000) {
  // Try random positions first.
  for (let attempt = 0; attempt < 2500; attempt++) {
    const x = 3 + randomInt(GRID - 6);
    const y = 3 + randomInt(GRID - 6);

    if (Math.hypot(x - avoidX, y - avoidY) < 20) continue;
    if (cellOccupied(x, y)) continue;

    // Do not spawn directly inside a trail or on a snake.
    // Prefer open neutral land; owned land is a fallback.
    if (territory[cellIndex(x, y)] === 0) {
      return { x, y };
    }
  }

  // Fallback: find any unoccupied land cell.
  for (let attempt = 0; attempt < 8000; attempt++) {
    const x = randomInt(GRID);
    const y = randomInt(GRID);

    if (!cellOccupied(x, y)) return { x, y };
  }

  // This is extremely unlikely, but avoids an infinite loop.
  return { x: randomInt(GRID), y: randomInt(GRID) };
}

// ============================================================
// CREATE SNAKES
// ============================================================

function createSnake(id, isPlayer, color) {
  const spawn = findOpenLand(
    player ? player.head.x : -1000,
    player ? player.head.y : -1000
  );

  const dir = randomDirection();
  const d = directions[dir];

  const body = [];

  for (let i = 0; i < 10; i++) {
    const x = spawn.x - d.x * i;
    const y = spawn.y - d.y * i;

    if (!inBounds(x, y)) break;

    body.push({ x, y });
  }

  while (body.length < 4) {
    body.push({ ...body[body.length - 1] });
  }

  const snake = {
    id,
    isPlayer,
    color,
    body,
    dir,
    trail: [],
    trailSet: new Set(),
    length: body.length,
    kills: 0,
    alive: true,
    sprintDrain: 0,
    aiTurnTimer: 0,
    aiGoal: null,
    moveCooldown: 0
  };

  // Starting territory.
  for (const segment of body) {
    territory[cellIndex(segment.x, segment.y)] = id;
  }

  return snake;
}

function initializeGame() {
  territory.fill(0);
  trailGrid.fill(-1);
  snakes = [];
  nextSnakeId = 2;
  gameOver = false;
  victory = false;
  moveAccumulator = 0;

  player = createSnake(PLAYER_ID, true, COLORS[1]);
  snakes.push(player);

  for (let i = 0; i < CPU_COUNT; i++) {
    const id = nextSnakeId++;
    const color = COLORS[2 + (i % 10)];
    snakes.push(createSnake(id, false, color));
  }

  document.getElementById("gameOver").classList.add("hidden");
  announce("Claim land by leaving your territory and returning!");
  updateHUD();
}

// ============================================================
// INPUT
// ============================================================

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (
    ["arrowup", "arrowdown", "arrowleft", "arrowright", " "]
      .includes(key)
  ) {
    event.preventDefault();
  }

  keys[key] = true;

  if (gameOver && key === "r") initializeGame();
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

window.addEventListener("blur", () => {
  keys = {};
});

function choosePlayerDirection() {
  let next = player.dir;

  if (keys.w || keys.arrowup) next = 3;
  else if (keys.s || keys.arrowdown) next = 1;
  else if (keys.a || keys.arrowleft) next = 2;
  else if (keys.d || keys.arrowright) next = 0;

  // No instant 180-degree turns.
  const opposite = (player.dir + 2) % 4;

  if (next !== opposite) player.dir = next;
}

function isSprinting(snake) {
  return snake.isPlayer
    ? Boolean(keys[" "] || keys.shift)
    : false;
}

// ============================================================
// SNAKE MOVEMENT
// ============================================================

function stepSnake(snake) {
  if (!snake.alive) return;

  if (snake.isPlayer) {
    choosePlayerDirection();
  } else {
    updateAI(snake);
  }

  const d = directions[snake.dir];
  const head = snake.body[0];

  const nx = head.x + d.x;
  const ny = head.y + d.y;

  // The board border is a wall, not a kill zone.
  if (!inBounds(nx, ny)) {
    if (!snake.isPlayer) {
      // CPUs turn away from the wall.
      snake.dir = randomDirection();
    }
    return;
  }

  const nextIndex = cellIndex(nx, ny);

  // Trails are not lethal. Entering a trail does not kill a snake.
  // Crossing another player's territory recolors the cell.
  const previousOwner = territory[nextIndex];

  if (previousOwner !== 0 && previousOwner !== snake.id) {
    territory[nextIndex] = snake.id;
  }

  // Collision with another snake's body is the combat mechanic.
  const collision = findBodyCollision(nx, ny, snake);

  if (collision) {
    if (snake.isPlayer) {
      endGame(false, "You collided with another snake!");
    } else {
      eliminateSnake(snake, collision);
    }
    return;
  }

  // Move forward.
  snake.body.unshift({ x: nx, y: ny });

  // If the head is outside its own territory, it draws a trail.
  if (territory[nextIndex] !== snake.id) {
    addTrailCell(snake, nx, ny);
  } else if (snake.trail.length > 0) {
    // Returning to owned territory closes the loop.
    captureTerritory(snake);
  }

  // Keep the snake at its intended length.
  snake.length = Math.max(4, snake.length);

  const sprinting = isSprinting(snake);

  if (sprinting) {
    // Sprint consumes actual body length.
    // It does not permanently shrink the snake below four segments.
    snake.sprintDrain++;

    if (snake.sprintDrain >= 3) {
      snake.sprintDrain = 0;

      if (snake.body.length > 4) {
        snake.body.pop();
        snake.length = snake.body.length;
      } else if (snake.isPlayer) {
        announce("Too short to sprint!");
      }
    }
  }

  while (snake.body.length > snake.length) {
    snake.body.pop();
  }

  // Don't trim away the head.
  if (snake.body.length < 4) snake.length = snake.body.length;

  updateHUD();
}

function findBodyCollision(x, y, movingSnake) {
  for (const snake of snakes) {
    if (!snake.alive) continue;

    // The moving snake's final tail cell is about to move away.
    const limit =
      snake === movingSnake
        ? Math.max(0, snake.body.length - 1)
        : snake.body.length;

    for (let i = 0; i < limit; i++) {
      const segment = snake.body[i];

      if (segment.x === x && segment.y === y) {
        return snake;
      }
    }
  }

  return null;
}

// ============================================================
// TRAILS
// ============================================================

function addTrailCell(snake, x, y) {
  const index = cellIndex(x, y);

  if (snake.trailSet.has(index)) return;

  snake.trail.push({ x, y });
  snake.trailSet.add(index);
  trailGrid[index] = snake.id;
}

// ============================================================
// ENCLOSED TERRITORY CAPTURE
// ============================================================

function captureTerritory(snake) {
  if (snake.trail.length === 0) return;

  // First claim the drawn line.
  for (const cell of snake.trail) {
    const index = cellIndex(cell.x, cell.y);
    territory[index] = snake.id;
    trailGrid[index] = -1;
  }

  snake.trail = [];
  snake.trailSet.clear();

  // Flood-fill all neutral land reachable from the outside.
  // Any neutral region not reachable from the border is enclosed
  // and becomes the capturing snake's territory.
  const visited = new Uint8Array(TOTAL_CELLS);
  const queue = new Int32Array(TOTAL_CELLS);
  let read = 0;
  let write = 0;

  function addOutside(x, y) {
    if (!inBounds(x, y)) return;

    const index = cellIndex(x, y);

    // Only neutral land is flood-filled. Owned territories
    // form barriers, so existing CPU land is not silently stolen.
    if (visited[index] || territory[index] !== 0) return;

    visited[index] = 1;
    queue[write++] = index;
  }

  // All four outer edges.
  for (let x = 0; x < GRID; x++) {
    addOutside(x, 0);
    addOutside(x, GRID - 1);
  }

  for (let y = 0; y < GRID; y++) {
    addOutside(0, y);
    addOutside(GRID - 1, y);
  }

  while (read < write) {
    const index = queue[read++];
    const x = index % GRID;
    const y = Math.floor(index / GRID);

    addOutside(x + 1, y);
    addOutside(x - 1, y);
    addOutside(x, y + 1);
    addOutside(x, y - 1);
  }

  let captured = 0;

  for (let i = 0; i < TOTAL_CELLS; i++) {
    if (territory[i] === 0 && visited[i] === 0) {
      territory[i] = snake.id;
      captured++;
    }
  }

  // Convert captured territory into snake length.
  if (captured > 0) {
    const growth = Math.min(200, Math.floor(captured / 3));

    snake.length = Math.min(
      snake.length + growth,
      2000
    );

    if (snake.isPlayer) {
      announce(
        captured.toLocaleString() +
        " land cells captured!"
      );
    }
  }

  updateHUD();
  checkVictory();
}

// ============================================================
// CPU AI
// ============================================================

function updateAI(snake) {
  snake.aiTurnTimer--;

  if (snake.aiTurnTimer <= 0) {
    snake.aiTurnTimer = 2 + randomInt(6);

    const head = snake.body[0];
    const choices = [];

    for (let dir = 0; dir < 4; dir++) {
      if (dir === (snake.dir + 2) % 4) continue;

      const d = directions[dir];
      const x = head.x + d.x;
      const y = head.y + d.y;

      if (!inBounds(x, y)) continue;

      if (findBodyCollision(x, y, snake)) continue;

      choices.push(dir);
    }

    if (choices.length > 0) {
      // Prefer neutral land when choosing a direction.
      let preferred = choices.filter((dir) => {
        const d = directions[dir];
        const x = head.x + d.x;
        const y = head.y + d.y;
        return territory[cellIndex(x, y)] === 0;
      });

      if (preferred.length === 0) preferred = choices;

      snake.dir = preferred[randomInt(preferred.length)];
    }
  }
}

// ============================================================
// CPU DEATH AND RESPAWNING
// ============================================================

function eliminateSnake(snake, killer) {
  if (!snake.alive) return;

  snake.alive = false;

  // Clear its unfinished trail.
  for (const cell of snake.trail) {
    const index = cellIndex(cell.x, cell.y);
    if (trailGrid[index] === snake.id) trailGrid[index] = -1;
  }

  snake.trail = [];
  snake.trailSet.clear();

  if (killer && killer !== snake) {
    killer.kills++;
    killer.length = Math.min(killer.length + 5, 2000);
  }

  if (snake.isPlayer) {
    endGame(false, "Your snake was eliminated!");
    return;
  }

  announce("A CPU snake was eliminated.");

  // Respawn only after the old snake is removed from collision checks.
  const oldIndex = snakes.indexOf(snake);
  if (oldIndex !== -1) snakes.splice(oldIndex, 1);

  window.setTimeout(() => {
    if (gameOver) return;

    const id = nextSnakeId++;
    const newSnake = createSnake(
      id,
      false,
      COLORS[2 + (id % 10)]
    );

    // The spawn helper avoids occupied cells and prefers neutral land.
    snakes.push(newSnake);
    updateHUD();
  }, 1200);

  updateHUD();
}

// ============================================================
// GAME SPEED
// ============================================================

function getStepDuration() {
  const sprinting = isSprinting(player);

  // Lower values mean faster movement.
  return sprinting ? 65 : 115;
}

// ============================================================
// CAMERA AND RENDERING
// ============================================================

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  viewWidth = window.innerWidth;
  viewHeight = window.innerHeight;

  canvas.width = Math.floor(viewWidth * dpr);
  canvas.height = Math.floor(viewHeight * dpr);

  canvas.style.width = viewWidth + "px";
  canvas.style.height = viewHeight + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  mini.width = 400;
  mini.height = 400;
}

window.addEventListener("resize", resize);
resize();

function updateCamera() {
  const head = player.body[0];

  camera.x = head.x * CELL_SIZE + CELL_SIZE / 2 - viewWidth / 2;
  camera.y = head.y * CELL_SIZE + CELL_SIZE / 2 - viewHeight / 2;

  camera.x = Math.max(
    0,
    Math.min(WORLD_SIZE - viewWidth, camera.x)
  );

  camera.y = Math.max(
    0,
    Math.min(WORLD_SIZE - viewHeight, camera.y)
  );
}

function drawWorld() {
  updateCamera();

  ctx.clearRect(0, 0, viewWidth, viewHeight);

  // Grass background.
  ctx.fillStyle = "#718a54";
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  const startX = Math.max(0, Math.floor(camera.x / CELL_SIZE));
  const startY = Math.max(0, Math.floor(camera.y / CELL_SIZE));

  const endX = Math.min(
    GRID,
    Math.ceil((camera.x + viewWidth) / CELL_SIZE) + 1
  );

  const endY = Math.min(
    GRID,
    Math.ceil((camera.y + viewHeight) / CELL_SIZE) + 1
  );

  // Territory.
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const owner = territory[cellIndex(x, y)];

      if (owner === 0) continue;

      ctx.fillStyle = COLORS[owner] || "#ddd";

      ctx.fillRect(
        x * CELL_SIZE - camera.x,
        y * CELL_SIZE - camera.y,
        CELL_SIZE + 0.5,
        CELL_SIZE + 0.5
      );
    }
  }

  // Subtle terrain grid.
  ctx.strokeStyle = "#263c2420";
  ctx.lineWidth = 1;

  for (let x = startX; x <= endX; x++) {
    const px = x * CELL_SIZE - camera.x;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, viewHeight);
    ctx.stroke();
  }

  for (let y = startY; y <= endY; y++) {
    const py = y * CELL_SIZE - camera.y;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(viewWidth, py);
    ctx.stroke();
  }

  // Trails are harmless and are not solid barriers.
  for (const snake of snakes) {
    if (!snake.alive) continue;

    ctx.fillStyle = snake.color;

    for (const cell of snake.trail) {
      ctx.fillRect(
        cell.x * CELL_SIZE - camera.x + 4,
        cell.y * CELL_SIZE - camera.y + 4,
        CELL_SIZE - 8,
        CELL_SIZE - 8
      );
    }
  }

  // Snakes.
  for (const snake of snakes) {
    if (!snake.alive) continue;

    for (let i = snake.body.length - 1; i >= 0; i--) {
      const segment = snake.body[i];

      const x = segment.x * CELL_SIZE - camera.x;
      const y = segment.y * CELL_SIZE - camera.y;

      ctx.fillStyle = snake.color;

      ctx.beginPath();
      ctx.roundRect(
        x + 2,
        y + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4,
        9
      );
      ctx.fill();

      if (i === 0) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x + 14, y + 13, 4, 0, Math.PI * 2);
        ctx.arc(x + 26, y + 13, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#182018";
        ctx.beginPath();
        ctx.arc(x + 15, y + 14, 2, 0, Math.PI * 2);
        ctx.arc(x + 27, y + 14, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // The boundary is visibly a wall.
  ctx.strokeStyle = "#20291e";
  ctx.lineWidth = 12;

  ctx.strokeRect(
    -camera.x,
    -camera.y,
    WORLD_SIZE,
    WORLD_SIZE
  );

  drawMinimap();
}

// ============================================================
// MINIMAP
// ============================================================

function drawMinimap() {
  const size = mini.width;
  const scale = size / GRID;

  mctx.clearRect(0, 0, size, size);
  mctx.fillStyle = "#6d8750";
  mctx.fillRect(0, 0, size, size);

  // Downsample the full territory map to the minimap.
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const owner = territory[cellIndex(x, y)];

      if (owner === 0) continue;

      mctx.fillStyle = COLORS[owner] || "#ddd";
      mctx.fillRect(x * scale, y * scale, scale + 0.2, scale + 0.2);
    }
  }

  // Show CPU heads.
  for (const snake of snakes) {
    if (!snake.alive || snake.isPlayer) continue;

    const head = snake.body[0];

    mctx.fillStyle = snake.color;
    mctx.fillRect(
      head.x * scale - 1,
      head.y * scale - 1,
      4,
      4
    );
  }

  // Player marker.
  if (player && player.body.length) {
    const head = player.body[0];

    mctx.fillStyle = "#fff";
    mctx.fillRect(
      head.x * scale - 3,
      head.y * scale - 3,
      7,
      7
    );

    mctx.strokeStyle = "#111";
    mctx.lineWidth = 1;
    mctx.strokeRect(
      head.x * scale - 3,
      head.y * scale - 3,
      7,
      7
    );
  }

  mctx.strokeStyle = "#20291e";
  mctx.lineWidth = 3;
  mctx.strokeRect(0, 0, size, size);
}

// ============================================================
// HUD AND WIN CONDITION
// ============================================================

function getTerritoryPercent() {
  let owned = 0;

  for (let i = 0; i < TOTAL_CELLS; i++) {
    if (territory[i] === PLAYER_ID) owned++;
  }

  return owned / TOTAL_CELLS * 100;
}

function updateHUD() {
  if (!player) return;

  const percent = getTerritoryPercent();

  document.getElementById("territory").textContent =
    percent.toFixed(1) + "%";

  document.getElementById("length").textContent =
    player.length;

  document.getElementById("kills").textContent =
    player.kills;

  document.getElementById("cpuCount").textContent =
    snakes.filter((s) => !s.isPlayer && s.alive).length;

  document.getElementById("progressFill").style.width =
    Math.min(100, percent) + "%";
}

function checkVictory() {
  if (getTerritoryPercent() >= 99.99) {
    endGame(true, "You conquered the entire world!");
  }
}

// ============================================================
// MESSAGES AND GAME END
// ============================================================

function announce(message) {
  noticeText = message;
  noticeTimer = 2.2;
  document.getElementById("notice").textContent = message;
}

function endGame(won, message) {
  if (gameOver) return;

  gameOver = true;
  victory = won;

  document.getElementById("resultTitle").textContent =
    won ? "WORLD CONQUERED!" : "GAME OVER";

  document.getElementById("resultText").textContent =
    message +
    " Territory: " +
    getTerritoryPercent().toFixed(1) +
    "% — Kills: " +
    player.kills;

  document.getElementById("gameOver").classList.remove("hidden");
}

document.getElementById("restartButton").addEventListener(
  "click",
  initializeGame
);

// ============================================================
// MAIN LOOP
// ============================================================

function frame(timestamp) {
  const delta = lastTime ? Math.min(timestamp - lastTime, 100) : 0;
  lastTime = timestamp;

  if (!gameOver) {
    moveAccumulator += delta;

    let steps = 0;

    while (
      moveAccumulator >= getStepDuration() &&
      steps < 4 &&
      !gameOver
    ) {
      moveAccumulator -= getStepDuration();

      // Player moves first.
      if (player && player.alive) {
        stepSnake(player);
      }

      // CPU snakes.
      const currentSnakes = [...snakes];

      for (const snake of currentSnakes) {
        if (!snake.isPlayer && snake.alive && !gameOver) {
          stepSnake(snake);
        }
      }

      steps++;
    }

    if (noticeTimer > 0) {
      noticeTimer -= delta / 1000;

      if (noticeTimer <= 0) {
        document.getElementById("notice").textContent = "";
      }
    }
  }

  drawWorld();
  requestAnimationFrame(frame);
}

// ============================================================
// START IMMEDIATELY — NO MAIN MENU
// ============================================================

initializeGame();
requestAnimationFrame(frame);
