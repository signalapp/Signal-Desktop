// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyDeep } from 'type-fest';

export type PackageJsonType = ReadonlyDeep<{
  name: string;
  version: string;
  productName: string;
  build: {
    appId: string;
    mac: {
      releaseInfo: {
        vendor: {
          minOSVersion: string;
        };
      };
    };
    deb: {
      depends: Array<string>;
    };
    files: Array<string | Record<string, unknown>>;
  };
}>;
