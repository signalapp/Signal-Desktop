// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

declare module 'heic-convert' {
  export default function heicConvert(options: {
    buffer: Uint8Array;
    format: string;
    quality: number;
  }): Promise<Buffer>;
}
