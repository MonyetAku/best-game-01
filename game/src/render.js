// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin
// filled with the backdrop colour. Flat shapes and canvas text for the HUD
// and the panels; the monkey, mangoes, coconuts and eagles are all drawn
// from code, so the game ships no image files at all.
import { FIELD, FONT, LIVES, PALETTE } from './config.js';
import { KIND_COCONUT, KIND_EAGLE, KIND_GOLD, KIND_LEAF, KIND_MANGO } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** The panel's width; its height grows with its lines. */
const PANEL = { width: 640, top: 140, line: 34, bottom: 76 };
const LIFE_SIZE = 20;
const LIFE_GAP = 8;

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function heartPath(context, x, y, size) {
  context.beginPath();
  context.moveTo(x + size / 2, y + size * 0.9);
  context.bezierCurveTo(x - size * 0.2, y + size * 0.45, x + size * 0.1, y - size * 0.1, x + size / 2, y + size * 0.25);
  context.bezierCurveTo(x + size * 0.9, y - size * 0.1, x + size * 1.2, y + size * 0.45, x + size / 2, y + size * 0.9);
  context.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const levelLabel = cachedLabel('Level ');
  const finalLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const goalLabel = cachedLabel('Goal ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    // A dark outline keeps light text readable over the bright sky and clouds.
    context.lineWidth = 4;
    context.strokeStyle = 'rgba(18,36,26,0.55)';
    context.textAlign = align;
    context.strokeText(value, x, y);
    context.fillStyle = color;
    context.fillText(value, x, y);
  }

  function drawSky(state) {
    const sky = context.createLinearGradient(0, 0, 0, FIELD.groundY);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = sky;
    context.fillRect(0, 0, FIELD.width, FIELD.groundY);
    // Sun.
    context.fillStyle = PALETTE.sun;
    context.beginPath();
    context.arc(1120, 110, 52, 0, Math.PI * 2);
    context.fill();
    // Drifting clouds.
    context.fillStyle = 'rgba(255,255,255,0.85)';
    const drift = (state.elapsed * 12) % 1400;
    for (const cloud of [
      { x: 180, y: 90, w: 150 },
      { x: 620, y: 150, w: 190 },
      { x: 1020, y: 60, w: 130 },
    ]) {
      const cx = ((cloud.x + drift) % 1400) - 60;
      context.beginPath();
      context.ellipse(cx, cloud.y, cloud.w / 2, 26, 0, 0, Math.PI * 2);
      context.ellipse(cx + 40, cloud.y + 10, cloud.w / 3, 20, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawTrees(state, color, height, speed, seed) {
    context.fillStyle = color;
    const offset = (state.elapsed * speed) % 320;
    for (let x = -320 + offset; x < FIELD.width + 320; x += 320) {
      const h = height * (0.75 + 0.25 * Math.sin((x + seed) * 0.013));
      const trunkX = x + 72;
      const topY = FIELD.groundY - h;
      // Trunk, then a canopy of three overlapping circles, each filled on
      // its own so no gap shows where they meet.
      context.fillRect(trunkX, topY + h * 0.45, 16, h * 0.55);
      for (const [cx, cy, r] of [
        [trunkX + 8, topY + h * 0.35, 52],
        [trunkX - 34, topY + h * 0.5, 40],
        [trunkX + 50, topY + h * 0.5, 40],
      ]) {
        context.beginPath();
        context.arc(cx, cy, r, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawGround(state) {
    context.fillStyle = PALETTE.ground;
    context.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
    context.fillStyle = PALETTE.groundTop;
    context.fillRect(0, FIELD.groundY, FIELD.width, 10);
    // Grass tufts, placed by a fixed pattern so the frame is repeatable.
    context.fillStyle = PALETTE.grass;
    for (let x = 24; x < FIELD.width; x += 86) {
      const sway = Math.sin(state.elapsed * 2 + x * 0.05) * 3;
      context.beginPath();
      context.moveTo(x + sway, FIELD.groundY + 10);
      context.lineTo(x + 6 + sway, FIELD.groundY - 12);
      context.lineTo(x + 12 + sway, FIELD.groundY + 10);
      context.closePath();
      context.fill();
    }
    // Vines hanging from the canopy.
    context.strokeStyle = PALETTE.nearTrees;
    context.lineWidth = 5;
    for (const vx of [120, 430, 760, 1090]) {
      context.beginPath();
      context.moveTo(vx, 0);
      context.quadraticCurveTo(vx + 18, 60, vx - 6, 110);
      context.stroke();
      context.fillStyle = PALETTE.leaf;
      context.beginPath();
      context.ellipse(vx - 6, 118, 12, 7, 0.5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawItem(item) {
    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;
    if (item.kind === KIND_COCONUT) {
      context.fillStyle = PALETTE.coconut;
      context.beginPath();
      context.arc(cx, cy, item.width / 2, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.coconutDark;
      context.beginPath();
      context.arc(cx - 5, cy - 5, 3, 0, Math.PI * 2);
      context.arc(cx + 6, cy - 3, 3, 0, Math.PI * 2);
      context.arc(cx, cy + 6, 3, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.25)';
      context.beginPath();
      context.arc(cx - item.width / 5, cy - item.width / 5, item.width / 6, 0, Math.PI * 2);
      context.fill();
    } else if (item.kind === KIND_MANGO || item.kind === KIND_GOLD) {
      const gold = item.kind === KIND_GOLD;
      context.fillStyle = gold ? PALETTE.golden : PALETTE.mango;
      context.beginPath();
      context.ellipse(cx, cy, item.width / 2, item.height / 2.4, -0.4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.leaf;
      context.beginPath();
      context.ellipse(cx + 4, cy - item.height / 2 + 2, 8, 4, -0.6, 0, Math.PI * 2);
      context.fill();
      if (gold) {
        const twinkle = 0.6 + 0.4 * Math.sin(item.phase * 2);
        context.fillStyle = `rgba(255,255,255,${twinkle.toFixed(2)})`;
        context.beginPath();
        context.arc(cx - 4, cy - 3, 3.5, 0, Math.PI * 2);
        context.fill();
      }
    } else if (item.kind === KIND_LEAF) {
      context.fillStyle = PALETTE.leaf;
      context.beginPath();
      context.ellipse(cx, cy, item.width / 2, item.height / 3, -0.5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#1e7a32';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(cx - 10, cy + 5);
      context.lineTo(cx + 10, cy - 5);
      context.stroke();
    } else if (item.kind === KIND_EAGLE) {
      const flap = Math.sin(item.phase) * 14;
      context.fillStyle = PALETTE.eagle;
      // Wings.
      context.beginPath();
      context.moveTo(cx - 10, cy);
      context.quadraticCurveTo(cx - 46, cy - 26 - flap, cx - 58, cy - 6 - flap);
      context.quadraticCurveTo(cx - 30, cy + 4, cx - 10, cy + 6);
      context.closePath();
      context.fill();
      context.beginPath();
      context.moveTo(cx + 10, cy);
      context.quadraticCurveTo(cx + 46, cy - 26 - flap, cx + 58, cy - 6 - flap);
      context.quadraticCurveTo(cx + 30, cy + 4, cx + 10, cy + 6);
      context.closePath();
      context.fill();
      // Body and beak.
      context.beginPath();
      context.ellipse(cx, cy, 30, 13, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.golden;
      const beakX = item.dir >= 0 ? cx + 30 : cx - 30;
      context.beginPath();
      context.moveTo(beakX, cy - 4);
      context.lineTo(beakX + (item.dir >= 0 ? 12 : -12), cy);
      context.lineTo(beakX, cy + 4);
      context.closePath();
      context.fill();
    }
  }

  function drawMonkey(player, elapsed) {
    const cx = player.x + player.width / 2;
    const feet = player.y + player.height;
    const bob = player.onGround ? Math.sin(elapsed * 10) * 1.5 : 0;
    const lean = Math.max(-0.12, Math.min(0.12, player.vx * 0.00012));
    context.save();
    context.translate(cx, feet);
    context.rotate(lean * player.facing);
    // Tail.
    context.strokeStyle = PALETTE.player;
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(-player.facing * 18, -34);
    context.quadraticCurveTo(-player.facing * 44, -52 + bob, -player.facing * 30, -66);
    context.stroke();
    // Body.
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.ellipse(0, -34 + bob, 24, 28, 0, 0, Math.PI * 2);
    context.fill();
    // Belly.
    context.fillStyle = PALETTE.playerBelly;
    context.beginPath();
    context.ellipse(player.facing * 4, -30 + bob, 13, 17, 0, 0, Math.PI * 2);
    context.fill();
    // Head.
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.facing * 6, -62 + bob, 20, 0, Math.PI * 2);
    context.fill();
    // Ears.
    context.beginPath();
    context.arc(player.facing * 6 - 18, -64 + bob, 7, 0, Math.PI * 2);
    context.arc(player.facing * 6 + 18, -64 + bob, 7, 0, Math.PI * 2);
    context.fill();
    // Face.
    context.fillStyle = PALETTE.playerFace;
    context.beginPath();
    context.ellipse(player.facing * 10, -60 + bob, 13, 11, 0, 0, Math.PI * 2);
    context.fill();
    // Eyes.
    context.fillStyle = '#1c1410';
    context.beginPath();
    context.arc(player.facing * 10 + 5, -64 + bob, 2.6, 0, Math.PI * 2);
    context.arc(player.facing * 10 + 12, -64 + bob, 2.6, 0, Math.PI * 2);
    context.fill();
    // Feet.
    context.fillStyle = PALETTE.player;
    context.fillRect(-16, -6, 14, 6);
    context.fillRect(4, -6, 14, 6);
    context.restore();
  }

  function drawField(state) {
    drawSky(state);
    drawTrees(state, PALETTE.farTrees, 150, 8, 7);
    drawTrees(state, PALETTE.nearTrees, 210, 16, 29);
    drawGround(state);
    for (const item of state.items) {
      if (item.active) drawItem(item);
    }
    const player = state.player;
    if (player.invulnerable === 0 || Math.floor(player.invulnerable * 10) % 2 === 1) {
      drawMonkey(player, state.elapsed);
    }
    // Particles.
    for (const particle of state.particles) {
      if (!particle.active) continue;
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // Floating score texts.
    for (const floater of state.floaters) {
      if (!floater.active) continue;
      context.globalAlpha = Math.max(0, floater.life / floater.maxLife);
      text(floater.text, floater.x, floater.y, 24, floater.color, 'center');
    }
    context.globalAlpha = 1;
  }

  function drawHud(state, best, muted) {
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 28, PALETTE.text, 'left');
    text(levelLabel(state.level), FIELD.width / 2, 18, 28, PALETTE.text, 'center');
    const mult = Math.min(5, 1 + Math.floor(state.combo / 4));
    if (state.combo >= 4) {
      text(`COMBO x${mult}`, 24, 52, 22, PALETTE.golden, 'left');
    }
    // Goal progress bar.
    const barX = FIELD.width / 2 - 130;
    const barY = 56;
    const progress = Math.min(1, state.score / state.winTarget);
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.fillRect(barX, barY, 260, 12);
    context.fillStyle = PALETTE.golden;
    context.fillRect(barX, barY, 260 * progress, 12);
    text(goalLabel(state.winTarget), FIELD.width / 2, 72, 18, PALETTE.text, 'center');
    // Lives as hearts.
    const firstHeart = FIELD.width - 24 - LIVES * (LIFE_SIZE + LIFE_GAP) + LIFE_GAP;
    text('Lives', firstHeart - 12, 18, 28, PALETTE.text, 'right');
    for (let life = 0; life < LIVES; life += 1) {
      context.fillStyle = life < state.lives ? PALETTE.heart : 'rgba(0,0,0,0.35)';
      heartPath(context, firstHeart + life * (LIFE_SIZE + LIFE_GAP), 24, LIFE_SIZE);
      context.fill();
    }
    // Shield and dash indicators.
    let badgeY = 92;
    if (state.player.shield) {
      text('SHIELD', FIELD.width - 24, badgeY, 20, PALETTE.leaf, 'right');
      badgeY += 26;
    }
    const dashReady = state.player.dashCooldown <= 0;
    context.fillStyle = 'rgba(0,0,0,0.35)';
    context.fillRect(24, FIELD.height - 34, 150, 10);
    context.fillStyle = dashReady ? PALETTE.dash : 'rgba(125,211,252,0.4)';
    const dashFill = dashReady ? 1 : 1 - state.player.dashCooldown / 1.1;
    context.fillRect(24, FIELD.height - 34, 150 * Math.max(0, Math.min(1, dashFill)), 10);
    text(dashReady ? 'DASH READY  [Shift]' : 'DASH…', 24, FIELD.height - 58, 16, PALETTE.text, 'left');
    if (muted) text('MUTED  [M]', FIELD.width - 24, FIELD.height - 58, 16, PALETTE.muted, 'right');
    text(bestLabel(best), FIELD.width - 24, 52, 20, PALETTE.muted, 'right');
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 48, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 22, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 40, 24, PALETTE.golden, 'center');
  }

  const TITLE_LINES = [
    'Catch the mangoes. Dodge the coconuts.',
    'Jump the eagles. Reach 400 for the Golden Mango!',
    'Move ← → or A D · Jump Space · Dash Shift · Pause P',
    '',
  ];
  const PAUSED_LINES = ['The coconuts will wait for you.'];

  /** Paint one frame: the field, then the HUD or a panel for the screen. */
  function draw(state, screen, best, muted) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? Math.sin(state.elapsed * 47) * state.shake : 0;
    const shakeY = state.shake > 0 ? Math.cos(state.elapsed * 39) * state.shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[3] = bestLabel(best);
      drawPanel('MANGO RUSH', TITLE_LINES, 'Press Space or click to start');
      return;
    }
    drawHud(state, best, muted);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      drawPanel('Game over', [`${finalLabel(state.score)}`, bestLabel(best)], 'Press Space or click to play again');
    } else if (screen === SCREEN_WIN) {
      drawPanel('GOLDEN MANGO!', [`${finalLabel(state.score)}`, bestLabel(best)], 'Press C to keep playing · Space to restart');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
