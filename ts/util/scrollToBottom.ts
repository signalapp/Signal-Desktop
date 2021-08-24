// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function scrollToBottom(el: HTMLElement): void {
  // We want to mutate the parameter here.
  // eslint-disable-next-line no-param-reassign
  el.scrollTop = el.scrollHeight;
}
