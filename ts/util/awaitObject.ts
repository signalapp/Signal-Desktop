// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export async function awaitObject<
  Result extends { [key: string]: unknown },
>(settings: {
  [key in keyof Result]: Promise<Result[key]>;
}): Promise<Result> {
  const keys = Object.keys(settings);
  const promises = new Array<Promise<unknown>>();
  for (const key of keys) {
    promises.push(settings[key as keyof Result] as Promise<unknown>);
  }

  const values = await Promise.all(promises);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {};
  for (const [i, key] of keys.entries()) {
    result[key] = values[i];
  }
  return result;
}
