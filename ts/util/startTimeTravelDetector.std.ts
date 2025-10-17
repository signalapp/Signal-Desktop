// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const INTERVAL = 1000;

export function startTimeTravelDetector(callback: () => unknown): void {
  let lastTime = Date.now();
  setInterval(() => {
    const currentTime = Date.now();

    const sinceLastTime = currentTime - lastTime;
    if (sinceLastTime > INTERVAL * 2) {
      callback();
    }

    lastTime = currentTime;
  }, INTERVAL);
}
