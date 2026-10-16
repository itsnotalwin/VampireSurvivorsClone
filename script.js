/*
  Eternal Night — Vampire Survivors Clone
  Working combat: auto-attacking weapons, enemy health, XP/leveling,
  weapon upgrades, difficulty scaling, game over.
*/

// ===== Canvas Setup =====
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let CANVAS_WIDTH, CANVAS_HEIGHT;

function resize() {
  CANVAS_WIDTH = canvas.clientWidth;
  CANVAS_HEIGHT = canvas.clientHeight;
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
}
window.addEventListener('resize', resize);
resize();

// ===== Colors / Palette =====
const COLORS = {
  bg: '#0a0a0f',
  player: '#e8e8f0',
  playerGlow: '#6a5acd',
  enemy: '#c53030',
  enemyGlow: '#ff6b6b',
  xp: '#ffd700',
  xpGlow: '#ffe066',
  whip: '#9370db',
  wand: '#00d2ff',
  ui: '#e8e8f0',
};

// ===== Game State =====
const state = {
  running: false,
  gameOver: false,
  levelUp: false,
  level: 1,
  kills: 0,
  xp: 0,
  xpToNext: 10,
  gold: 0,
  time: 0,
  playerSpeed: 180,
  enemyBaseSpeed: 60,
  enemyBaseHealth: 20,
  spawnRate: 1.2,
  difficultyTimer: 0,
};

const keys = { w: false, a: false, s: false, d: false };

// ===== Entities =====
const player = {
  x: 0,
  y: 0,
  radius: 10,
  speed: state.playerSpeed,
  hp: 100,
  maxHp: 100,
  invincible: 0,
  knockbackResist: 0.5,
};

const enemies = [];
const weapons = [];
const xpGems = [];
const particles = [];

// ===== Weapon Definitions =====
const WEAPONS = [
  {
    id: 'whip',
    name: 'Whip',
    desc: 'Swinging arc attack around player',
    cooldown: 0.8,
    damage: 12,
    range: 70,
    width: 26,
    level: 0,
    maxLevel: 8,
  },
  {
    id: 'wand',
    name: 'Magic Wand',
    desc: 'Auto-fires at nearest enemy',
    cooldown: 1.0,
    damage: 8,
    range: 200,
    width: 6,
    level: 0,
    maxLevel: 6,
  },
  {
    id: 'cross',
    name: 'Holy Cross',
    desc: 'Explosions around player',
    cooldown: 2.0,
    damage: 20,
    range: 110,
    width: 110,
    level: 0,
    maxLevel: 5,
  },
  {
    id: 'garlic',
    name: 'Pine Garlic',
    desc: 'Aura damage around player',
    cooldown: 0.5,
    damage: 6,
    range: 55,
    width: 55,
    level: 0,
    maxLevel: 8,
  },
  {
    id: 'knife',
    name: 'Throwing Knife',
    desc: 'Thrown in movement direction',
    cooldown: 0.4,
    damage: 10,
    range: 180,
    width: 8,
    level: 0,
    maxLevel: 7,
  },
];

// Start with Whip and Garlic
const playerWeapons = [
  { ...WEAPONS[0], level: 1, lastFire: 0 },
  { ...WEAPONS[3], level: 1, lastFire: 0 },
];

// ===== Utility =====
function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

// ===== Particle System =====
function spawnParticles(x, y, color, count = 6) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: randomRange(-40, 40),
      vy: randomRange(-40, 40),
      life: 0.4 + Math.random() * 0.4,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vx *= 0.9;
    p.vy *= 0.9;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = p.life;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ===== Player =====
function updatePlayer(dt) {
  let dx = 0, dy = 0;
  if (keys.w) dy -= 1;
  if (keys.s) dy += 1;
  if (keys.a) dx -= 1;
  if (keys.d) dx += 1;

  if (dx !== 0 && dy !== 0) {
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;
  }

  player.x += dx * player.speed * dt;
  player.y += dy * player.speed * dt;

  player.x = clamp(player.x, player.radius, CANVAS_WIDTH - player.radius);
  player.y = clamp(player.y, player.radius, CANVAS_HEIGHT - player.radius);

  if (player.invincible > 0) player.invincible -= dt;

  // Player knockback from enemies
  for (const e of enemies) {
    const d = dist(player.x, player.y, e.x, e.y);
    if (d < player.radius + e.radius && d > 0) {
      const overlap = player.radius + e.radius - d;
      const nx = (player.x - e.x) / d;
      const ny = (player.y - e.y) / d;
      player.x += nx * overlap * 0.5;
      player.y += ny * overlap * 0.5;
    }
  }
}

function drawPlayer() {
  const flash = player.invincible > 0 && Math.floor(player.invincible * 20) % 2 === 0;
  if (flash) return;

  ctx.save();
  ctx.shadowColor = COLORS.playerGlow;
  ctx.shadowBlur = 15;
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Direction indicator (small line where player is facing/moving)
  const moveX = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  const moveY = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
  if (moveX !== 0 || moveY !== 0) {
    const len = Math.hypot(moveX, moveY);
    ctx.save();
    ctx.strokeStyle = COLORS.playerGlow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + (moveX / len) * 16, player.y + (moveY / len) * 16);
    ctx.stroke();
    ctx.restore();
  }
}

// ===== Enemies =====
function spawnEnemy() {
  // Spawn from edges
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = randomRange(0, CANVAS_WIDTH); y = -30; }
  else if (side === 1) { x = CANVAS_WIDTH + 30; y = randomRange(0, CANVAS_HEIGHT); }
  else if (side === 2) { x = randomRange(0, CANVAS_WIDTH); y = CANVAS_HEIGHT + 30; }
  else { x = -30; y = randomRange(0, CANVAS_HEIGHT); }

  const levelMultiplier = 1 + (state.level - 1) * 0.25;
  const timeMultiplier = 1 + Math.min(state.time / 60, 5) * 0.15;

  enemies.push({
    x, y,
    radius: 8 + Math.random() * 4,
    health: state.enemyBaseHealth * levelMultiplier * timeMultiplier,
    maxHealth: 0, // set below
    speed: (state.enemyBaseSpeed + Math.random() * 30) * levelMultiplier * timeMultiplier,
    type: Math.random() < 0.15 ? 'fast' : 'normal',
  });
  enemies[enemies.length - 1].maxHealth = enemies[enemies.length - 1].health;
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    // Chase player
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d > 0) {
      const speedMult = e.type === 'fast' ? 1.6 : 1;
      e.x += (dx / d) * e.speed * speedMult * dt;
      e.y += (dy / d) * e.speed * speedMult * dt;
    }

    // Damage player on contact
    if (d < player.radius + e.radius && player.invincible <= 0) {
      player.invincible = 1.0;
      player.hp -= 15;
      spawnParticles(player.x, player.y, COLORS.enemy, 4);
      if (player.hp <= 0) {
        gameOver();
      }
    }

    // Remove off-screen
    if (e.x < -50 || e.x > CANVAS_WIDTH + 50 || e.y < -50 || e.y > CANVAS_HEIGHT + 50) {
      enemies.splice(i, 1);
    }
  }
}

function drawEnemies() {
  for (const e of enemies) {
    ctx.save();
    ctx.shadowColor = COLORS.enemyGlow;
    ctx.shadowBlur = 10;
    ctx.fillStyle = COLORS.enemy;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Health bar
    const barW = e.radius * 2;
    const barH = 3;
    const hpPct = e.health / e.maxHealth;
    ctx.fillStyle = '#333';
    ctx.fillRect(e.x - barW / 2, e.y - e.radius - 8, barW, barH);
    ctx.fillStyle = COLORS.enemy;
    ctx.fillRect(e.x - barW / 2, e.y - e.radius - 8, barW * hpPct, barH);
  }
}

// ===== Weapons =====
function updateWeapons(dt) {
  for (const w of playerWeapons) {
    w.lastFire += dt;
    if (w.lastFire >= w.cooldown / (1 + w.level * 0.15)) {
      fireWeapon(w);
      w.lastFire = 0;
    }
  }

  // Update active weapon projectiles/hits
  for (let i = weapons.length - 1; i >= 0; i--) {
    const w = weapons[i];
    w.life -= dt;
    if (w.life <= 0) {
      weapons.splice(i, 1);
      continue;
    }
    if (w.x !== undefined) {
      w.x += w.vx * dt;
      w.y += w.vy * dt;
    }
  }
}

function fireWeapon(w) {
  if (w.id === 'whip') {
    // Swinging arc around player
    const angleOffset = (Math.PI / 4) * (w.level % 4);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const angle = a + angleOffset;
      const startX = player.x + Math.cos(angle) * 10;
      const startY = player.y + Math.sin(angle) * 10;
      const endX = player.x + Math.cos(angle) * w.range;
      const endY = player.y + Math.sin(angle) * w.range;
      weapons.push({
        id: 'whip',
        x: startX, y: startY,
        endX, endY,
        angle,
        range: w.range,
        damage: w.damage * (1 + w.level * 0.2),
        width: w.width,
        life: 0.25,
      });
    }
  } else if (w.id === 'wand') {
    // Target nearest enemy
    let nearest = null;
    let nearestDist = w.range;
    for (const e of enemies) {
      const d = dist(player.x, player.y, e.x, e.y);
      if (d < nearestDist) {
        nearest = e;
        nearestDist = d;
      }
    }
    if (nearest) {
      const dx = nearest.x - player.x;
      const dy = nearest.y - player.y;
      const d = Math.hypot(dx, dy);
      weapons.push({
        id: 'wand',
        x: player.x, y: player.y,
        vx: (dx / d) * 200,
        vy: (dy / d) * 200,
        damage: w.damage * (1 + w.level * 0.2),
        width: w.width,
        life: 1.5,
        homing: nearest,
      });
    }
  } else if (w.id === 'cross') {
    // Explosion around player
    const numExplosions = 4 + Math.floor(w.level / 2);
    for (let i = 0; i < numExplosions; i++) {
      const angle = (i / numExplosions) * Math.PI * 2;
      weapons.push({
        id: 'cross',
        x: player.x, y: player.y,
        vx: Math.cos(angle) * 60,
        vy: Math.sin(angle) * 60,
        damage: w.damage * (1 + w.level * 0.2),
        width: w.range,
        life: 0.6,
        explosion: true,
      });
    }
  } else if (w.id === 'garlic') {
    // Aura - instant hit around player
    for (const e of enemies) {
      const d = dist(player.x, player.y, e.x, e.y);
      if (d < w.range) {
        e.health -= w.damage * (1 + w.level * 0.2);
        if (e.health <= 0) killEnemy(e);
      }
    }
    // Visual pulse
    weapons.push({
      id: 'garlic',
      x: player.x, y: player.y,
      damage: w.damage * (1 + w.level * 0.2),
      width: w.range,
      life: 0.3,
      aura: true,
    });
  } else if (w.id === 'knife') {
    // Thrown in last movement direction
    const moveX = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    const moveY = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
    let dirX = moveX, dirY = moveY;
    if (dirX === 0 && dirY === 0) { dirX = 1; dirY = 0; }
    const len = Math.hypot(dirX, dirY);
    dirX /= len; dirY /= len;
    weapons.push({
      id: 'knife',
      x: player.x, y: player.y,
      vx: dirX * 250,
      vy: dirY * 250,
      damage: w.damage * (1 + w.level * 0.2),
      width: w.width,
      life: 0.8,
    });
  }
}

function killEnemy(e) {
  const idx = enemies.indexOf(e);
  if (idx >= 0) enemies.splice(idx, 1);
  state.kills++;
  state.xp += 5 + Math.floor(state.level * 0.5);
  state.gold += 2;
  spawnParticles(e.x, e.y, COLORS.xp, 8);
  spawnXPGem(e.x, e.y);
  checkLevelUp();
}

function spawnXPGem(x, y) {
  xpGems.push({
    x, y,
    radius: 5,
    life: 5,
    floatY: 0,
  });
}

function updateXPGems(dt) {
  for (let i = xpGems.length - 1; i >= 0; i--) {
    const g = xpGems[i];
    g.life -= dt;
    g.floatY = Math.sin(state.time * 4) * 3;

    // Move toward player
    const dx = player.x - g.x;
    const dy = player.y - g.y;
    const d = Math.hypot(dx, dy);
    if (d > 0) {
      const speed = d < 100 ? 200 : 60;
      g.x += (dx / d) * speed * dt;
      g.y += (dy / d) * speed * dt;
    }

    // Collect
    if (d < player.radius + g.radius) {
      state.xp += 10 + Math.floor(state.level);
      xpGems.splice(i, 1);
      checkLevelUp();
      continue;
    }

    if (g.life <= 0) xpGems.splice(i, 1);
  }
}

function drawXPGems() {
  for (const g of xpGems) {
    ctx.save();
    ctx.shadowColor = COLORS.xpGlow;
    ctx.shadowBlur = 12;
    ctx.fillStyle = COLORS.xp;
    ctx.beginPath();
    ctx.arc(g.x, g.y + g.floatY, g.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawWeapons() {
  for (const w of weapons) {
    if (w.aura) {
      // Garlic aura - subtle pulse
      const alpha = Math.sin(state.time * 10) * 0.3 + 0.4;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.wand;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.width, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }

    if (w.id === 'whip') {
      ctx.save();
      ctx.strokeStyle = COLORS.whip;
      ctx.lineWidth = w.width;
      ctx.lineCap = 'round';
      ctx.shadowColor = COLORS.whip;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(w.x, w.y);
      ctx.lineTo(w.endX, w.endY);
      ctx.stroke();
      ctx.restore();
    } else if (w.id === 'wand') {
      ctx.save();
      ctx.fillStyle = COLORS.wand;
      ctx.shadowColor = COLORS.wand;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (w.id === 'cross') {
      ctx.save();
      ctx.strokeStyle = COLORS.wand;
      ctx.lineWidth = 3;
      ctx.shadowColor = COLORS.wand;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.width * (1 - w.life / 0.6), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (w.id === 'knife') {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ===== Collision: Weapons vs Enemies =====
function resolveWeaponCollisions() {
  for (let wi = weapons.length - 1; wi >= 0; wi--) {
    const w = weapons[wi];
    let hitAny = false;

    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      let hit = false;

      if (w.id === 'whip') {
        // Line segment vs circle
        hit = lineCircleCollision(w.x, w.y, w.endX, w.endY, e.x, e.y, e.radius + w.width / 2);
      } else if (w.aura) {
        hit = dist(w.x, w.y, e.x, e.y) < w.width + e.radius;
      } else if (w.explosion) {
        hit = dist(w.x, w.y, e.x, e.y) < w.width + e.radius;
      } else {
        // Circle vs circle (projectile)
        hit = dist(w.x, w.y, e.x, e.y) < w.width / 2 + e.radius;
      }

      if (hit) {
        e.health -= w.damage;
        spawnParticles(e.x, e.y, '#ff6b6b', 2);
        if (e.health <= 0) killEnemy(e);
        hitAny = true;
        if (w.id !== 'whip' && w.id !== 'garlic' && !w.aura) break;
      }
    }

    if (hitAny && (w.id === 'wand' || w.id === 'knife' || w.id === 'cross')) {
      weapons.splice(wi, 1);
    }
  }
}

function lineCircleCollision(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = ((cx - x1) * dx + (cy - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return dist(px, py, cx, cy) < r;
}

// ===== Level Progression =====
function checkLevelUp() {
  while (state.xp >= state.xpToNext) {
    state.xp -= state.xpToNext;
    state.level++;
    state.xpToNext = Math.floor(state.xpToNext * 1.5);
    state.levelUp = true;
    state.running = false; // pause game
  }
  updateUI();
}

function openLevelUp() {
  const overlay = document.getElementById('levelup-overlay');
  const choices = document.getElementById('choices');
  choices.innerHTML = '';

  // Pick 3 random weapon/upgrade options
  const options = [];
  for (const base of WEAPONS) {
    const existing = playerWeapons.find(w => w.id === base.id);
    if (existing && existing.level >= existing.maxLevel) continue;
    options.push({ ...base, existing });
  }
  // Shuffle and pick 3
  options.sort(() => Math.random() - 0.5);
  const picked = options.slice(0, 3);

  picked.forEach(opt => {
    const card = document.createElement('div');
    card.className = 'choice-card';
    const has = opt.existing;
    const newLevel = (has ? has.level : 0) + 1;
    card.innerHTML = `
      <h3>${has ? `Upgrade ${opt.name}` : `New: ${opt.name}`}</h3>
      <p>${opt.desc}</p>
      <p style="margin-top:10px; font-size:0.85rem; color:var(--muted);">
        ${has ? `Lvl ${has.level} → ${newLevel}` : `Level ${newLevel}`}
      </p>
    `;
    card.onclick = () => applyLevelUp(opt);
    choices.appendChild(card);
  });

  overlay.classList.remove('hidden');
}

function applyLevelUp(opt) {
  const existing = playerWeapons.find(w => w.id === opt.id);
  if (existing) {
    existing.level++;
  } else {
    playerWeapons.push({ ...opt, level: 1, lastFire: 0 });
  }
  state.levelUp = false;
  state.running = true;
  document.getElementById('levelup-overlay').classList.add('hidden');
  // Resume loop
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function gameOver() {
  state.gameOver = true;
  state.running = false;
  document.getElementById('survive-time').textContent = Math.floor(state.time);
  document.getElementById('final-kills').textContent = state.kills;
  document.getElementById('gameover-overlay').classList.remove('hidden');
}

// ===== Game Loop =====
let lastTime = performance.now();

function gameLoop(now) {
  if (!state.running || state.gameOver) return;

  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  state.time += dt;
  state.difficultyTimer += dt;

  // Difficulty scaling
  if (state.difficultyTimer > 10) {
    state.difficultyTimer = 0;
    state.spawnRate = Math.max(0.4, state.spawnRate * 0.9);
    state.enemyBaseSpeed *= 1.05;
    state.enemyBaseHealth *= 1.1;
  }

  // Clear
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Subtle grid
  ctx.strokeStyle = '#1a1a24';
  ctx.lineWidth = 1;
  const grid = 40;
  for (let x = 0; x < CANVAS_WIDTH; x += grid) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke();
  }
  for (let y = 0; y < CANVAS_HEIGHT; y += grid) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke();
  }

  updatePlayer(dt);
  drawPlayer();

  updateWeapons(dt);
  resolveWeaponCollisions();
  drawWeapons();

  // Spawn enemies
  state.spawnTimer = (state.spawnTimer || 0) - dt;
  if (state.spawnTimer <= 0) {
    const count = 1 + Math.floor(state.level / 3);
    for (let i = 0; i < count; i++) spawnEnemy();
    state.spawnTimer = state.spawnRate / (1 + state.level * 0.1);
  }

  updateEnemies(dt);
  drawEnemies();

  updateXPGems(dt);
  drawXPGems();

  updateParticles(dt);
  drawParticles();

  updateUI();

  requestAnimationFrame(gameLoop);
}

// ===== UI =====
function updateUI() {
  document.getElementById('level-val').textContent = state.level;
  document.getElementById('kills-val').textContent = state.kills;
  document.getElementById('xp-val').textContent = state.xp;
  document.getElementById('xp-next').textContent = state.xpToNext;
  document.getElementById('time-val').textContent =
    Math.floor(state.time / 60) + ':' + String(Math.floor(state.time % 60)).padStart(2, '0');

  const pct = (state.xp / state.xpToNext) * 100;
  document.getElementById('xp-bar').style.width = pct + '%';

  const hud = document.getElementById('weapon-hud');
  hud.innerHTML = '';
  for (const w of playerWeapons) {
    const item = document.createElement('div');
    item.className = 'weapon-item';
    item.innerHTML = `<div>${w.name}</div><div class="level">Lvl ${w.level}</div>`;
    hud.appendChild(item);
  }
}

// ===== Input =====
document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = true;
  if (e.key === 'Enter' && !state.running && !state.levelUp && !state.gameOver) startGame();
});

document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = false;
});

// Touch controls (virtual joystick area)
let touchStartX = 0, touchStartY = 0;
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!state.running) return;
  const t = e.touches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const mag = Math.hypot(dx, dy);
  if (mag > 10) {
    keys.w = dy < -10;
    keys.s = dy > 10;
    keys.a = dx < -10;
    keys.d = dx > 10;
  } else {
    keys.w = keys.s = keys.a = keys.d = false;
  }
}, { passive: false });

canvas.addEventListener('touchend', () => {
  keys.w = keys.s = keys.a = keys.d = false;
});

// ===== Start / Restart =====
function startGame() {
  state.running = true;
  state.gameOver = false;
  state.levelUp = false;
  state.level = 1;
  state.kills = 0;
  state.xp = 0;
  state.xpToNext = 10;
  state.gold = 0;
  state.time = 0;
  state.playerSpeed = 180;
  state.enemyBaseSpeed = 60;
  state.enemyBaseHealth = 20;
  state.spawnRate = 1.2;
  state.difficultyTimer = 0;
  state.spawnTimer = 0;

  player.x = CANVAS_WIDTH / 2;
  player.y = CANVAS_HEIGHT / 2;
  player.hp = player.maxHp;
  player.invincible = 0;

  enemies.length = 0;
  xpGems.length = 0;
  weapons.length = 0;
  particles.length = 0;

  playerWeapons.length = 0;
  playerWeapons.push({ ...WEAPONS[0], level: 1, lastFire: 0 });
  playerWeapons.push({ ...WEAPONS[3], level: 1, lastFire: 0 });

  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('gameover-overlay').classList.add('hidden');
  document.getElementById('levelup-overlay').classList.add('hidden');
  updateUI();

  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

// Initial draw
ctx.fillStyle = COLORS.bg;
ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
ctx.fillStyle = '#666';
ctx.font = '16px system-ui';
ctx.textAlign = 'center';
ctx.fillText('Press Start to begin', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);