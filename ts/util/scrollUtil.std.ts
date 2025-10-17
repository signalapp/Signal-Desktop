// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export const getScrollBottom = (
  el: Readonly<Pick<HTMLElement, 'clientHeight' | 'scrollHeight' | 'scrollTop'>>
): number => el.scrollHeight - el.scrollTop - el.clientHeight;

export function setScrollBottom(
  el: Pick<HTMLElement, 'clientHeight' | 'scrollHeight' | 'scrollTop'>,
  newScrollBottom: number
): void {
  // We want to mutate the parameter here.
  // eslint-disable-next-line no-param-reassign
  el.scrollTop = el.scrollHeight - newScrollBottom - el.clientHeight;
}

export function scrollToBottom(
  el: Pick<HTMLElement, 'scrollHeight' | 'scrollTop'>
): void {
  // We want to mutate the parameter here.
  // eslint-disable-next-line no-param-reassign
  el.scrollTop = el.scrollHeight;
}
