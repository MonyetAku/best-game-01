// The game's rules and state, with no drawing and no browser in it: the
// monkey, the pool of falling coconuts and fruit, the swooping eagles,
// spawning, collisions, score, combo, lives, level and the win goal. step()
// advances one fixed step and returns what happened as bit flags, so the
// caller can react (sounds, announcements) without the world knowing about
// screens or sound. Nothing here allocates after createWorld returns.
import {
  COCONUT,
  EAGLE,
  FIELD,
  GOLDEN,
  LEAF,
  LEVEL,
  LIVES,
  MANGO,
  PARTICLE_POOL,
  FLOATER_POOL,
  PLAYER,
  POOL_SIZE,
  WIN_SCORE,
} from './config.js';

export const KIND_COCONUT = 0;
export const KIND_MANGO = 1;
export const KIND_GOLD = 2;
export const KIND_EAGLE = 3;
export const KIND_LEAF = 4;

export const EVENT_HIT = 1;
export const EVENT_COIN = 2;
export const EVENT_GOLD = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_JUMP = 32;
export const EVENT_DASH = 64;
export const EVENT_SHIELD = 128;
export const EVENT_SHIELD_BLOCK = 256;

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function createWorld(random) {
  const player = {
    x: 0,
    y: FIELD.groundY - PLAYER.height,
    width: PLAYER.width,
    height: PLAYER.height,
    vx: 0,
    vy: 0,
    onGround: true,
    dashTime: 0,
    dashCooldown: 0,
    invulnerable: 0,
    shield: false,
    facing: 1,
  };
  const items = [];
  for (let index = 0; index < POOL_SIZE; index += 1) {
    items.push({ active: false, kind: KIND_COCONUT, x: 0, y: 0, width: 0, height: 0, speed: 0, dir: 1, phase: 0 });
  }
  const particles = [];
  for (let index = 0; index < PARTICLE_POOL; index += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, color: '#fff', size: 3 });
  }
  const floaters = [];
  for (let index = 0; index < FLOATER_POOL; index += 1) {
    floaters.push({ active: false, x: 0, y: 0, text: '', life: 0, maxLife: 1, color: '#fff' });
  }
  const state = {
    player,
    items,
    particles,
    floaters,
    score: 0,
    lives: LIVES,
    level: 1,
    elapsed: 0,
    combo: 0,
    comboTimer: 0,
    winTarget: WIN_SCORE,
    won: false,
    shake: 0,
    coconutTimer: 0,
    mangoTimer: 0,
    goldTimer: 0,
    eagleTimer: 0,
    leafTimer: 0,
  };

  function reset() {
    player.x = (FIELD.width - player.width) / 2;
    player.y = FIELD.groundY - player.height;
    player.vx = 0;
    player.vy = 0;
    player.onGround = true;
    player.dashTime = 0;
    player.dashCooldown = 0;
    player.invulnerable = 0;
    player.shield = false;
    player.facing = 1;
    for (const item of items) item.active = false;
    for (const particle of particles) particle.active = false;
    for (const floater of floaters) floater.active = false;
    state.score = 0;
    state.lives = LIVES;
    state.level = 1;
    state.elapsed = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.winTarget = WIN_SCORE;
    state.won = false;
    state.shake = 0;
    state.coconutTimer = COCONUT.interval;
    state.mangoTimer = MANGO.interval;
    state.goldTimer = GOLDEN.interval;
    state.eagleTimer = EAGLE.interval;
    state.leafTimer = LEAF.interval;
  }

  function comboMultiplier() {
    return Math.min(5, 1 + Math.floor(state.combo / 4));
  }

  function burst(x, y, color, count, speed) {
    let made = 0;
    for (const particle of particles) {
      if (made >= count) break;
      if (particle.active) continue;
      const angle = random() * Math.PI * 2;
      const power = speed * (0.4 + random() * 0.8);
      particle.active = true;
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * power;
      particle.vy = Math.sin(angle) * power - speed * 0.4;
      particle.maxLife = 0.5 + random() * 0.4;
      particle.life = particle.maxLife;
      particle.color = color;
      particle.size = 2 + random() * 4;
      made += 1;
    }
  }

  function floater(x, y, text, color) {
    for (const item of floaters) {
      if (item.active) continue;
      item.active = true;
      item.x = x;
      item.y = y;
      item.text = text;
      item.maxLife = 0.9;
      item.life = item.maxLife;
      item.color = color;
      return;
    }
  }

  function freeItem() {
    for (const item of items) if (!item.active) return item;
    return null;
  }

  function spawnCoconut() {
    const item = freeItem();
    if (item === null) return;
    const radius = COCONUT.minRadius + random() * (COCONUT.maxRadius - COCONUT.minRadius);
    item.active = true;
    item.kind = KIND_COCONUT;
    item.width = radius * 2;
    item.height = radius * 2;
    item.x = random() * (FIELD.width - item.width);
    item.y = -item.height;
    item.speed = COCONUT.speed + COCONUT.speedPerLevel * (state.level - 1) + random() * COCONUT.speedJitter;
    item.phase = random() * Math.PI * 2;
  }

  function spawnMango() {
    const item = freeItem();
    if (item === null) return;
    item.active = true;
    item.kind = KIND_MANGO;
    item.width = MANGO.size;
    item.height = MANGO.size;
    item.x = random() * (FIELD.width - item.width);
    item.y = -item.height;
    item.speed = MANGO.speed + MANGO.speedPerLevel * (state.level - 1);
    item.phase = random() * Math.PI * 2;
  }

  function spawnGold() {
    const item = freeItem();
    if (item === null) return;
    item.active = true;
    item.kind = KIND_GOLD;
    item.width = GOLDEN.size;
    item.height = GOLDEN.size;
    item.x = random() * (FIELD.width - item.width);
    item.y = -item.height;
    item.speed = MANGO.speed + 40;
    item.phase = random() * Math.PI * 2;
  }

  function spawnEagle() {
    const item = freeItem();
    if (item === null) return;
    const fromLeft = random() < 0.5;
    item.active = true;
    item.kind = KIND_EAGLE;
    item.width = EAGLE.width;
    item.height = EAGLE.height;
    item.x = fromLeft ? -item.width : FIELD.width;
    item.y = FIELD.groundY - item.height;
    item.speed = EAGLE.speed + EAGLE.speedPerLevel * (state.level - 1);
    item.dir = fromLeft ? 1 : -1;
    item.phase = random() * Math.PI * 2;
  }

  function spawnLeaf() {
    const item = freeItem();
    if (item === null) return;
    item.active = true;
    item.kind = KIND_LEAF;
    item.width = LEAF.size;
    item.height = LEAF.size;
    item.x = random() * (FIELD.width - item.width);
    item.y = -item.height;
    item.speed = LEAF.speed;
    item.phase = random() * Math.PI * 2;
  }

  function coconutInterval() {
    return Math.max(COCONUT.minInterval, COCONUT.interval * COCONUT.intervalScale ** (state.level - 1));
  }

  function takeHit(item) {
    item.active = false;
    if (player.shield) {
      player.shield = false;
      player.invulnerable = 1.0;
      burst(player.x + player.width / 2, player.y + player.height / 2, '#37b24d', 14, 260);
      floater(player.x + player.width / 2, player.y - 12, 'SHIELD!', '#37b24d');
      return EVENT_SHIELD_BLOCK;
    }
    state.lives -= 1;
    state.combo = 0;
    state.comboTimer = 0;
    player.invulnerable = PLAYER.invulnerable;
    state.shake = 12;
    burst(player.x + player.width / 2, player.y + player.height / 2, '#ff5a5a', 18, 320);
    if (state.lives === 0) return EVENT_HIT | EVENT_OVER;
    return EVENT_HIT;
  }

  function collect(item, points, color, event) {
    item.active = false;
    const gained = points * comboMultiplier();
    state.score += gained;
    state.combo += 1;
    state.comboTimer = 3;
    burst(item.x + item.width / 2, item.y + item.height / 2, color, 10, 220);
    floater(item.x + item.width / 2, item.y - 6, `+${gained}`, color);
    return event;
  }

  /**
   * One fixed step. `direction` is -1, 0 or 1; `jump` and `dash` are one-shot
   * presses for this step. With `harmless` set (the title screen's backdrop)
   * things fall but nothing touches the player and nothing scores.
   */
  function step(dt, direction, jump, dash, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.level = Math.min(LEVEL.max, 1 + Math.floor(state.elapsed / LEVEL.seconds));
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);

    // The monkey's own movement.
    if (!harmless) {
      if (dash && player.dashCooldown <= 0 && player.dashTime <= 0) {
        player.dashTime = PLAYER.dashTime;
        player.dashCooldown = PLAYER.dashCooldown;
        player.invulnerable = Math.max(player.invulnerable, 0.3);
        events |= EVENT_DASH;
      }
      if (player.dashTime > 0) {
        player.dashTime -= dt;
        player.vx = player.facing * PLAYER.dashSpeed;
      } else {
        player.vx = direction * PLAYER.speed;
        if (direction !== 0) player.facing = direction;
      }
      if (player.dashCooldown > 0) player.dashCooldown -= dt;
      if (jump && player.onGround) {
        player.vy = -PLAYER.jumpVelocity;
        player.onGround = false;
        events |= EVENT_JUMP;
      }
      player.vy += PLAYER.gravity * dt;
      player.x = Math.min(FIELD.width - player.width, Math.max(0, player.x + player.vx * dt));
      player.y += player.vy * dt;
      if (player.y + player.height >= FIELD.groundY) {
        player.y = FIELD.groundY - player.height;
        player.vy = 0;
        player.onGround = true;
      }
      if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    }

    // Spawning.
    state.coconutTimer -= dt;
    if (state.coconutTimer <= 0) {
      spawnCoconut();
      state.coconutTimer += coconutInterval();
    }
    state.mangoTimer -= dt;
    if (state.mangoTimer <= 0) {
      spawnMango();
      state.mangoTimer += MANGO.interval + random() * MANGO.intervalJitter;
    }
    state.goldTimer -= dt;
    if (state.goldTimer <= 0) {
      spawnGold();
      state.goldTimer += GOLDEN.interval;
    }
    if (state.level >= EAGLE.firstLevel) {
      state.eagleTimer -= dt;
      if (state.eagleTimer <= 0) {
        spawnEagle();
        state.eagleTimer += EAGLE.interval + random() * EAGLE.intervalJitter;
      }
    }
    state.leafTimer -= dt;
    if (state.leafTimer <= 0) {
      spawnLeaf();
      state.leafTimer += LEAF.interval;
    }

    // Falling things, and what they do when they arrive.
    for (const item of items) {
      if (!item.active) continue;
      if (item.kind === KIND_EAGLE) {
        item.x += item.dir * item.speed * dt;
        item.phase += dt * 14;
        if (item.x < -item.width - 40 || item.x > FIELD.width + 40) item.active = false;
      } else {
        item.y += item.speed * dt;
        item.phase += dt * 3;
        if (item.y > FIELD.groundY) {
          item.active = false;
          if (item.kind === KIND_COCONUT && !harmless) state.score += COCONUT.dodgePoints;
          continue;
        }
      }
      if (harmless || !overlaps(item, player)) continue;
      if (item.kind === KIND_MANGO) {
        events |= collect(item, MANGO.points, '#ff9f1c', EVENT_COIN);
      } else if (item.kind === KIND_GOLD) {
        events |= collect(item, GOLDEN.points, '#ffd700', EVENT_GOLD);
      } else if (item.kind === KIND_LEAF) {
        item.active = false;
        player.shield = true;
        burst(item.x + item.width / 2, item.y + item.height / 2, '#37b24d', 12, 240);
        floater(item.x + item.width / 2, item.y - 6, 'SHIELD!', '#37b24d');
        events |= EVENT_SHIELD;
      } else if (player.invulnerable === 0) {
        events |= takeHit(item);
        if (events & EVENT_OVER) break;
      }
    }

    // Particles and floating texts always age, whatever the screen.
    for (const particle of particles) {
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 500 * dt;
    }
    for (const floaterItem of floaters) {
      if (!floaterItem.active) continue;
      floaterItem.life -= dt;
      floaterItem.y -= 42 * dt;
      if (floaterItem.life <= 0) floaterItem.active = false;
    }

    // The win goal can be reached by any kind of point — a mango, a golden
    // mango, or a dodged coconut — so it is checked here, once per step,
    // rather than in any one scoring path.
    if (!harmless && !state.won && state.score >= state.winTarget) {
      state.won = true;
      events |= EVENT_WIN;
    }
    return events;
  }

  /** After a win, keep playing toward the next goal instead of stopping. */
  function continueAfterWin() {
    state.won = false;
    state.winTarget += WIN_SCORE;
  }

  reset();
  return { state, reset, step, continueAfterWin, comboMultiplier };
}
