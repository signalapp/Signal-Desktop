export function put(key: string, value: any) {
  window.storage.put(key, value);
}

export async function remove(key: string) {
  await window.storage.remove(key);
}
