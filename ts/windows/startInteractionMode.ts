// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

let initialized = false;
let interactionMode: 'mouse' | 'keyboard' = 'mouse';

export function startInteractionMode(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  document.body.classList.add('mouse-mode');

  window.enterKeyboardMode = () => {
    if (interactionMode === 'keyboard') {
      return;
    }

    interactionMode = 'keyboard';

    document.body.classList.add('keyboard-mode');
    document.body.classList.remove('mouse-mode');

    const clearSelectedMessage =
      window.reduxActions?.conversations?.clearSelectedMessage;
    if (clearSelectedMessage) {
      clearSelectedMessage();
    }

    const userChanged = window.reduxActions?.user?.userChanged;
    if (userChanged) {
      userChanged({ interactionMode });
    }
  };
  window.enterMouseMode = () => {
    if (interactionMode === 'mouse') {
      return;
    }

    interactionMode = 'mouse';

    document.body.classList.add('mouse-mode');
    document.body.classList.remove('keyboard-mode');

    const clearSelectedMessage =
      window.reduxActions?.conversations?.clearSelectedMessage;
    if (clearSelectedMessage) {
      clearSelectedMessage();
    }

    const userChanged = window.reduxActions?.user?.userChanged;
    if (userChanged) {
      userChanged({ interactionMode });
    }
  };

  document.addEventListener(
    'keydown',
    event => {
      if (event.key === 'Tab') {
        window.enterKeyboardMode();
      }
    },
    true
  );
  document.addEventListener('wheel', window.enterMouseMode, true);
  document.addEventListener('mousedown', window.enterMouseMode, true);

  window.getInteractionMode = () => interactionMode;
}
