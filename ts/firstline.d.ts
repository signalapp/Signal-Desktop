// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

declare module 'firstline' {
  interface FirstLineOpts {
    encoding?: BufferEncoding;
    lineEnding?: '\n';
  }

  export default function firstLine(
    filePath: string,
    opts?: FirstLineOpts
  ): Promise<string>;
}
