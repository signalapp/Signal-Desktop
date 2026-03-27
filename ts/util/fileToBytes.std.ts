// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function fileToBytes(file: Blob): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, rejectPromise) => {
    // oxlint-disable-next-line no-undef FIXME
    const FR = new FileReader();
    FR.onload = () => {
      if (!FR.result || typeof FR.result === 'string') {
        rejectPromise(new Error('bytesFromFile: No result!'));
        return;
      }
      resolve(new Uint8Array(FR.result));
    };
    FR.onerror = rejectPromise;
    FR.onabort = rejectPromise;
    FR.readAsArrayBuffer(file);
  });
}
