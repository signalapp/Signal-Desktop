// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

declare module '@indutny/symbolicate-mac' {
  export function symbolicate(options: {
    file: string;
    force?: boolean;
  }): Promise<string>;
}
