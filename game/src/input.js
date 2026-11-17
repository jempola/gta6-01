// Keyboard and mouse input. Held keys are read every frame; one-shot presses
// (pause, interact, punch, reload) are queued as bit flags and taken once.
export const ACTION_PAUSE = 1;
export const ACTION_INTERACT = 2;
export const ACTION_PUNCH = 4;
export const ACTION_RELOAD = 8;
export const ACTION_MUTE = 16;

const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const PUNCH = new Set(['KeyF', 'Space']);
const RELOAD = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  window.addEventListener('keydown', (event) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
    else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    else if (RELOAD.has(event.code)) actions |= ACTION_RELOAD;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left; mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left; mouse.y = event.clientY - rect.top;
    mouse.down = true; mouse.clicked = true;
  });
  window.addEventListener('pointerup', () => { mouse.down = false; });

  return {
    keys, mouse,
    down(code) { return keys.has(code); },
    axis() {
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    running() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    takeActions() { const taken = actions; actions = 0; return taken; },
    takeClick() { const c = mouse.clicked; mouse.clicked = false; return c; },
  };
}
