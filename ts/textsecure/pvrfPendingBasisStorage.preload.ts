import { itemStorage } from './Storage.preload.js';

type PendingBasisStore = Record<string, Record<string, string>>;

const KEY = 'pvrfDemoPendingBasis' as const;

async function readStore(): Promise<PendingBasisStore> {
  return (await itemStorage.get(KEY)) ?? {};
}

async function writeStore(store: PendingBasisStore): Promise<void> {
  await itemStorage.put(KEY, store);
}

export async function setPendingBasis(
  serviceId: string,
  deviceId: number,
  payloadB64: string
): Promise<void> {
  const store = await readStore();
  const did = String(deviceId);

  store[serviceId] = store[serviceId] ?? {};
  store[serviceId][did] = payloadB64;

  await writeStore(store);
}

export async function getPendingBasis(
  serviceId: string,
  deviceId: number
): Promise<string | undefined> {
  const store = await readStore();
  return store[serviceId]?.[String(deviceId)];
}

export async function clearPendingBasis(
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
