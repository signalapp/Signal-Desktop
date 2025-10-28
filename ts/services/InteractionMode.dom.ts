// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

type InteractionModeType = 'mouse' | 'keyboard';

let initialized = false;
let interactionMode: InteractionModeType = 'mouse';

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

    const clearTargetedMessage =
      window.reduxActions?.conversations?.clearTargetedMessage;
    if (clearTargetedMessage) {
      clearTargetedMessage();
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

    const clearTargetedMessage =
      window.reduxActions?.conversations?.clearTargetedMessage;
    if (clearTargetedMessage) {
      clearTargetedMessage();
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
}

export function getInteractionMode(): InteractionModeType {
  return interactionMode;
}
