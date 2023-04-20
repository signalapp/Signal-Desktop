// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// eslint-disable-next-line @typescript-eslint/ban-types
export function throttle(func: Function, wait: number): () => void {
  let lastCallTime: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastArgs: Array<any> | undefined;
  let timerId: NodeJS.Timeout | undefined;

  function call() {
    const args = lastArgs || [];
    lastArgs = undefined;
    func(...args);
  }

  function leading() {
    timerId = setTimeout(timerExpired, wait);
    call();
  }

  function remainingWait(time: number) {
    const timeSinceLastCall = time - lastCallTime;
    return wait - timeSinceLastCall;
  }

  function shouldInvoke(time: number) {
    const timeSinceLastCall = time - lastCallTime;

    return (
      lastCallTime === undefined ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0
    );
  }

  function timerExpired() {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailing();
    }
    timerId = setTimeout(timerExpired, remainingWait(time));
  }

  function trailing() {
    timerId = undefined;

    if (lastArgs) {
      return call();
    }
    lastArgs = undefined;
  }

  return (...args) => {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastCallTime = time;

    if (isInvoking) {
      if (timerId === undefined) {
        return leading();
      }
    }
    if (timerId === undefined) {
      timerId = setTimeout(timerExpired, wait);
    }
  };
}
