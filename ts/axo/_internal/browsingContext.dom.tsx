// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/** False in inert documents (like `<template>` contents), which can't be measured */
export function isInBrowsingContext(element: Element): boolean {
  return element.ownerDocument.defaultView != null;
}
