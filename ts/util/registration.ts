// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { itemStorage } from '../textsecure/Storage.preload.js';

export async function markEverDone(): Promise<void> {
  await itemStorage.put('chromiumRegistrationDoneEver', '');
}

export async function markDone(): Promise<void> {
  await markEverDone();
  await itemStorage.put('chromiumRegistrationDone', '');
}

export async function remove(): Promise<void> {
  await itemStorage.remove('chromiumRegistrationDone');
}

export function isDone(): boolean {
  return itemStorage.get('chromiumRegistrationDone') === '';
}

export function everDone(): boolean {
  return itemStorage.get('chromiumRegistrationDoneEver') === '' || isDone();
}
