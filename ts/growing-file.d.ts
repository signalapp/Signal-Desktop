// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

declare module 'growing-file' {
  type GrowingFileOptions = {
    timeout?: number;
    interval?: number;
  };

  class GrowingFile {
    static open(path: string, options: GrowingFileOptions): Readable;
  }

  export default GrowingFile;
}
