// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LocalizerType } from './types/Util.std.js';

const DISPLAY_THRESHOLD = 3000; // milliseconds
const SELECTOR = '.app-loading-screen .message';

let timeout: null | ReturnType<typeof setTimeout>;
let targetString: string;
let didTimeout = false;

const clear = () => {
  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }
};

export function setAppLoadingScreenMessage(
  loadingText: undefined | string,
  i18n: LocalizerType
): () => void {
  const message = document.querySelector<HTMLElement>(SELECTOR);
  if (!message) {
    return clear;
  }

  targetString = loadingText || i18n('icu:optimizingApplication');

  message.innerText = didTimeout ? targetString : i18n('icu:loading');

  if (timeout) {
    return clear;
  }

  timeout = setTimeout(() => {
    didTimeout = true;
    const innerMessage = document.querySelector<HTMLElement>(SELECTOR);
    if (!innerMessage) {
      return;
    }
    innerMessage.innerText = targetString;
  }, DISPLAY_THRESHOLD);

  return clear;
}
