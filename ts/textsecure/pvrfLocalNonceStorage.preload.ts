// Copyright 2026
// SPDX-License-Identifier: AGPL-3.0-only

import { itemStorage } from './Storage.preload.js';

type LocalNonceStore = Record<string, Record<string, string>>;
// serviceId -> deviceId -> nonce_b64

const KEY = 'pvrfDemoLocalNonce' as const;

async function readStore(): Promise<LocalNonceStore> {
  return (await itemStorage.get(KEY)) ?? {};
}

async function writeStore(store: LocalNonceStore): Promise<void> {
  await itemStorage.put(KEY, store);
}

export async function setLocalNonce(
  serviceId: string,
  deviceId: number,
  nonceB64: string
): Promise<void> {
  const store = await readStore();
  const did = String(deviceId);

  store[serviceId] = store[serviceId] ?? {};
  store[serviceId][did] = nonceB64;

  await writeStore(store);
}

export async function getLocalNonce(
  serviceId: string,
  deviceId: number
): Promise<string | undefined> {
  const store = await readStore();
  return store[serviceId]?.[String(deviceId)];
}

export async function clearLocalNonce(
  serviceId: string,
  deviceId: number
): Promise<void> {
  const store = await readStore();
  const did = String(deviceId);

  if (!store[serviceId]) return;

  delete store[serviceId][did];
  if (Object.keys(store[serviceId]).length === 0) delete store[serviceId];

  await writeStore(store);
}