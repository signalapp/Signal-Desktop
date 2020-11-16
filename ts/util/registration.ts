// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function markEverDone(): void {
  window.storage.put('chromiumRegistrationDoneEver', '');
}

export function markDone(): void {
  markEverDone();
  window.storage.put('chromiumRegistrationDone', '');
}

export async function remove(): Promise<void> {
  await window.storage.remove('chromiumRegistrationDone');
}

export function isDone(): boolean {
  return window.storage.get('chromiumRegistrationDone') === '';
}

export function everDone(): boolean {
  return window.storage.get('chromiumRegistrationDoneEver') === '' || isDone();
}
