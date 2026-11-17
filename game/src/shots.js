// The screenshot scenes behind ?shot=start|play|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (look ahead each way the monkey could move, keep clear of
// coconuts, chase the lowest mango, jump the eagles), so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { FIELD, PLAYER, STEP } from './config.js';
import { EVENT_OVER, KIND_COCONUT, KIND_EAGLE } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 600;
/**
 * How far ahead, in seconds, the autopilot checks each way it could move: the
 * play scene's pilot looks well ahead and keeps all its lives; the end
 * scene's looks only a moment ahead and never jumps, so it is caught out
 * once the coconuts speed up, as a hurried player is.
 */
const HORIZON_PLAY = 0.7;
const HORIZON_END = 0.25;
const SAMPLE = 1 / 30;
const DIRECTIONS = [0, -1, 1];
/** Extra room, each side, it keeps between the monkey and a coconut. */
const MARGIN = 10;

/** Seconds until moving in `direction` runs the monkey into a coconut. */
function timeToHit(state, direction, horizon) {
  const player = state.player;
  for (let t = SAMPLE; t <= horizon; t += SAMPLE) {
    const x = Math.min(FIELD.width - player.width, Math.max(0, player.x + direction * PLAYER.speed * t));
    for (const item of state.items) {
      if (!item.active || item.kind !== KIND_COCONUT) continue;
      const y = item.y + item.speed * t;
      if (y + item.height > player.y && y < player.y + player.height && item.x < x + player.width + MARGIN && item.x + item.width > x - MARGIN) return t;
    }
  }
  return Infinity;
}

/** True when an eagle is about to reach the monkey on the ground. */
function eagleNear(state) {
  const player = state.player;
  if (!player.onGround) return false;
  for (const item of state.items) {
    if (!item.active || item.kind !== KIND_EAGLE) continue;
    const gap = item.dir >= 0 ? item.x - (player.x + player.width) : player.x - (item.x + item.width);
    if (gap > -20 && gap < 220) return true;
  }
  return false;
}

/** Of the safe ways to move, the one toward the lowest mango (or centre). */
export function autopilot(state, horizon, canJump) {
  const player = state.player;
  let mango = null;
  for (const item of state.items) {
    if (item.active && item.kind !== KIND_COCONUT && item.kind !== KIND_EAGLE && (mango === null || item.y > mango.y)) mango = item;
  }
  const target = mango === null ? FIELD.width / 2 : mango.x + mango.width / 2;
  const centre = player.x + player.width / 2;
  const wanted = target > centre + 8 ? 1 : target < centre - 8 ? -1 : 0;
  let best = wanted;
  let bestTime = timeToHit(state, wanted, horizon);
  for (const direction of DIRECTIONS) {
    if (bestTime === Infinity) break;
    const time = timeToHit(state, direction, horizon);
    if (time > bestTime) {
      bestTime = time;
      best = direction;
    }
  }
  return { direction: best, jump: canJump && eagleNear(state), dash: false };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, 0, false, false, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const horizon = name === 'end' ? HORIZON_END : HORIZON_PLAY;
  const canJump = name !== 'end';
  for (let index = 0; index < limit / STEP; index += 1) {
    const move = autopilot(world.state, horizon, canJump);
    if (world.step(STEP, move.direction, move.jump, move.dash, false) & EVENT_OVER) break;
  }
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
