// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { protocol, net } from 'electron';

import { isPathInside } from '../ts/util/isPathInside.node.ts';
import { getAppRootDir } from '../ts/util/appRootDir.main.ts';

type DevelopmentServiceOptions = Readonly<{
  isDevelopment: boolean;
}>;

export function start({ isDevelopment }: DevelopmentServiceOptions): void {
  if (!isDevelopment) {
    protocol.handle('bundles', () => {
      return new Response('Unavailable in production', {
        status: 404,
      });
    });
    return;
  }

  const BUNDLES_DIR = join(getAppRootDir(), 'bundles');

  // Serve source maps
  protocol.handle('bundles', req => {
    const url = new URL(req.url);
    const path = join(BUNDLES_DIR, url.pathname.slice(1));
    if (!isPathInside(path, BUNDLES_DIR)) {
      throw new Error(`Invalid source map request: ${path}`);
    }

    return net.fetch(pathToFileURL(path).toString());
  });
}
