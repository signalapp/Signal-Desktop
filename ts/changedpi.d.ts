// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

declare module 'changedpi' {
  function changeDpiBlob(blob: Blob, dpi: number): Promise<Blob>;
  function changeDpiDataUrl(url: string, dpi: number): string;
}
