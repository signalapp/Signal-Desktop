// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function isWindowDragElement(el: Readonly<Element>): boolean {
  let currentEl: Element | null = el;
  do {
    const appRegion =
      getComputedStyle(currentEl).getPropertyValue('-webkit-app-region');
    switch (appRegion) {
      case 'no-drag':
        return false;
      case 'drag':
        return true;
      default:
        currentEl = currentEl.parentElement;
        break;
    }
  } while (currentEl);
  return false;
}
