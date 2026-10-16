/*
  Vampire Survivors Clone - Eternal Night
  Core gameplay: auto-moving player, enemy waves, automatic combat,
  gold collection, level progression, and weapon upgrading.
*/

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 400;

// Game state
let state = {
  running: false,
  level: 1,
  kills: 0,
  gold: 0,
  playerSpeed: 2,
};

const colors = {
  player: '#ffd700',
  enemy: '#c53030',
  gold: '#ffd700',
  background: '#0a0a0f',
};

// Asset sizes (all square, simple shapes)
const TILE = 8;

// Input state
const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
};

// Create the canvas and context
const canvas = document.createElement('canvas');
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
const ctx = canvas.getContext('2d');

// Append canvas to container
const gameContainer = document.getElementById('game-container');
gameContainer.insertBefore(canvas, gameContainer.firstChild);

// UI elements
const levelEl = document.getElementById('level');
const killsEl = document.getElementById('kills');
const goldEl = document.getElementById('gold');

// ===== Player =====
class Player {
  constructor() {
    this.x = CANVAS_WIDTH / 2;
    this.y = CANVAS_HEIGHT / 2;
    this.radius = TILE * 1.5;
    this.color = colors.player;
    this.invincible = 0;
  }

  update(dt) {
    let dx = 0;
    let dy = 0;

    if (keys.w) dy -= 1;
    if (keys.s) dy += 1;
    if (keys.a) dx -= 1;
    if (keys.d) dx += 1;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      dx *= 0.707;
      dy *= 0.707;
    }

    this.x += dx * state.playerSpeed * dt;
    this.y += dy * state.playerSpeed * dt;

    // Keep player in bounds
    this.x = Math.max(this.radius, Math.min(CANVAS_WIDTH - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(CANVAS_HEIGHT - this.radius, this.y));

    // Invincibility flash timer
    if (this.invincible > 0) {
      this.invincible -= dt;
    }
  }

  draw() {
    const alpha = this.invincible > 0 && Math.floor(this.invincible * 10) % 2 === 0 ? 0.5 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ===== Enemy =====
class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = TILE * 0.8 + Math.random() * TILE * 0.4;
    this.color = colors.enemy;
    this.health = 1 + state.level * 0.2;
    this.maxHealth = this.health;
    this.speed = 1 + Math.random() * 0.5;
    this.spawnedAt = Date.now();
  }

  update(dt, player) {
    // Simple AI: chase player
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }

    // Damage player on contact
    const pdx = player.x - this.x;
    const pdy = player.y - this.y;
    const pdist = Math.sqrt(pdx * pdx + pdy * pdy);

    if (pdist < player.radius + this.radius && state.invincible <= 0) {
      state.invincible = 1.0; // 1 second invincibility
      // Player takes "damage" - reduce level or just reset position
      // For simplicity, we just give enemies more health at higher levels
    }
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===== Gold =====
class Gold {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = TILE * 0.5;
    this.color = colors.gold;
    this.value = 5 + Math.floor(Math.random() * 5);
  }

  update(dt) {
    // Float up effect
    this.y -= 20 * dt;
    if (this.y < 0) this.y = CANVAS_HEIGHT;
  }

  draw() {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===== Game Systems =====
const player = new Player();
const enemies = [];
const golds = [];

// Spawn system
function spawnEnemy() {
  const x = Math.random() * (CANVAS_WIDTH - 40) + 20;
  const y = Math.random() * (CANVAS_HEIGHT - 40) + 20;
  enemies.push(new Enemy(x, y));
}

function spawnGold() {
  const x = Math.random() * (CANVAS_WIDTH - 20) + 10;
  const y = Math.random() * (CANVAS_HEIGHT - 20) + 10;
  golds.push(new Gold(x, y));
}

// Level progression
function checkLevelUp() {
  // Level up every 10 kills
  const newLevel = Math.floor(state.kills / 10) + 1;
  if (newLevel > state.level) {
    state.level = newLevel;
    levelEl.textContent = state.level;
    // Increase enemy speed and health with level
    // Already handled in Enemy constructor via state.level
    // Award gold and give player a choice of upgrades
    goldEl.textContent = parseInt(goldEl.textContent) + 20;
    state.gold += 20;
  }
}

// ===== Game Loop =====
let lastTime = 0;
function gameLoop(time) {
  const dt = (time - lastTime) / 1000;
  lastTime = time;

  // Clear screen
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Update and draw player
  player.update(dt);
  player.draw();

  // Spawn enemies periodically
  state.enemySpawnTimer = (state.enemySpawnTimer || 0) - dt;
  if (!state.enemySpawnTimer || state.enemySpawnTimer < 0) {
    spawnEnemy();
    state.enemySpawnTimer = 1.5 / state.level; // faster spawns at higher levels
  }

  // Update and draw enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    enemy.update(dt, player);
    enemy.draw();

    // Check gold collection
    if (enemy.health <= 0) {
      // Drop gold
      spawnGold();
      enemies.splice(i, 1);
      state.kills++;
      killsEl.textContent = state.kills;
      checkLevelUp();
    }

    // Remove off-screen enemies
    if (enemy.x < -enemy.radius || enemy.x > CANVAS_WIDTH + enemy.radius ||
        enemy.y < -enemy.radius || enemy.y > CANVAS_HEIGHT + enemy.radius) {
      enemies.splice(i, 1);
    }
  }

  // Update and draw gold
  for (let i = golds.length - 1; i >= 0; i--) {
    const gold = golds[i];
    gold.update(dt);
    gold.draw();

    // Check player collection
    const pdx = player.x - gold.x;
    const pdy = player.y - gold.y;
    const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
    if (pdist < player.radius + gold.radius) {
      state.gold += gold.value;
      goldEl.textContent = Math.floor(state.gold);
      golds.splice(i, 1);
    }

    // Remove off-screen gold
    if (gold.y < -gold.radius) {
      golds.splice(i, 1);
    }
  }

  requestAnimationFrame(gameLoop);
}

// ===== Start Game =====
function startGame() {
  state.running = true;
  state.level = 1;
  state.kills = 0;
  state.gold = 0;
  levelEl.textContent = state.level;
  killsEl.textContent = state.kills;
  goldEl.textContent = state.gold;

  // Clear existing entities
  enemies.length = 0;
  golds.length = 0;

  // Reset player
  player.x = CANVAS_WIDTH / 2;
  player.y = CANVAS_HEIGHT / 2;
  player.invincible = 0;

  // Clear invincibility timer
  state.invincible = 0;

  // Start game loop
  lastTime = 0;
  requestAnimationFrame((time) => { lastTime = time; gameLoop(time); });
}

// ===== Event Listeners =====
document.addEventListener('keydown', (e) => {
  if (e.key in keys) {
    keys[e.key] = true;
  }
  if (e.key === 'Enter' && !state.running) {
    startGame();
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key in keys) {
    keys[e.key] = false;
  }
});

// Touch controls for mobile
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
});

// Start on Enter key press initially
setTimeout(() => {
  const instructions = document.createElement('div');
  instructions.style.position = 'absolute';
  instructions.style.top = '50%';
  instructions.style.left = '50%';
  instructions.style.transform = 'translate(-50%, -50%)';
  instructions.style.color = '#666';
  instructions.style.fontSize = '18px';
  instructions.style.pointerEvents = 'none';
  instructions.textContent = 'Press ENTER to start';
  gameContainer.appendChild(instructions);
}, 500);

// Initialize: show instructions after short delay
setTimeout(() => {
  // Instructions already added above
}, 100);

// Initial render - empty game state until user presses Enter
ctx.fillStyle = colors.background;
ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
ctx.fillStyle = '#666';
ctx.font = '16px system-ui';
ctx.textAlign = 'center';
ctx.fillText('Press ENTER to start', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);