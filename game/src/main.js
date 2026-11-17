// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, game over, and the Golden Mango win screen.
//
// ?seed=N fixes the falling pattern. ?shot=start|play|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, FIELD, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_COIN, EVENT_DASH, EVENT_GOLD, EVENT_HIT, EVENT_JUMP, EVENT_OVER, EVENT_SHIELD, EVENT_SHIELD_BLOCK, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_CONTINUE, ACTION_DASH, ACTION_JUMP, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts one visit.
  }
}

/** Convert a pointer's client x to a steering direction on the field. */
function pointerDirection() {
  const inputX = input.pointerX();
  if (inputX === null) return null;
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  const offsetX = (window.innerWidth - FIELD.width * scale) / 2;
  const fieldX = (inputX - offsetX) / scale;
  const centre = world.state.player.x + world.state.player.width / 2;
  if (fieldX > centre + 8) return 1;
  if (fieldX < centre - 8) return -1;
  return 0;
}

const input = createInput(canvas);

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${LIVES} lives. Reach ${world.state.winTarget} for the Golden Mango.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.over();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function winGame() {
    screen = SCREEN_WIN;
    audio.win();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Golden Mango! Score ${world.state.score}. Press C to keep playing.`);
  }

  function playSounds(events) {
    if (events & EVENT_COIN) audio.coin();
    if (events & EVENT_GOLD) audio.gold();
    if (events & EVENT_JUMP) audio.jump();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_HIT) audio.hit();
    if (events & (EVENT_SHIELD | EVENT_SHIELD_BLOCK)) audio.shield();
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame();
    } else if (screen === SCREEN_WIN) {
      if (actions & ACTION_CONTINUE) {
        world.continueAfterWin();
        screen = SCREEN_PLAY;
        announce(`Playing on. Next goal ${world.state.winTarget}.`);
      } else if (actions & ACTION_CONFIRM) startGame();
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, 0, false, false, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    // One-shot presses are read once per frame, not per step, so a jump or a
    // dash pressed between frames still lands on the very next step — and a
    // press that started the game does not also make the monkey jump.
    const pointerDir = pointerDirection();
    const direction = pointerDir !== null ? pointerDir : input.direction();
    const events = world.step(
      STEP,
      direction,
      Boolean(actions & ACTION_JUMP),
      Boolean(actions & ACTION_DASH),
      false,
    );
    playSounds(events);
    if (events & EVENT_WIN) winGame();
    else if (events & EVENT_OVER) endGame();
    else if (events & EVENT_HIT) {
      announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Read the one-shot presses once per frame: handleActions takes the
    // menu keys, the first step takes jump and dash, later steps take none.
    const actions = input.takeActions();
    const screenBefore = screen;
    handleActions(actions);
    const freshStart = screen !== screenBefore;
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(first && !freshStart ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, audio.isMuted());
  }

  // Leaving the tab pauses a running game rather than letting fruit fall unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Mango Rush. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
