// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { protocol } from 'electron';

import type { OptionalResourceService } from './OptionalResourceService.main.ts';
import { getAppRootDir } from '../ts/util/appRootDir.main.ts';
import { toWebStream } from '../ts/util/toWebStream.node.ts';

const LOCAL_ASSETS = new Set([
  'fonts/signal-symbols/SignalSymbolsVariable.woff2',
  'fonts/stories/Hatsuishi-Regular.woff2',
  'fonts/stories/EBGaramond-Regular.ttf',
  'fonts/stories/Parisienne-Regular.ttf',
  'fonts/stories/BarlowCondensed-Medium.ttf',
  'fonts/inter-v3.19/Inter-Medium.woff2',
  'fonts/inter-v3.19/Inter-Regular.woff2',
  'fonts/inter-v3.19/Inter-SemiBold.woff2',
  'fonts/inter-v3.19/Inter-BoldItalic.woff2',
  'fonts/inter-v3.19/Inter-Bold.woff2',
  'fonts/inter-v3.19/Inter-Italic.woff2',
  'fonts/inter-v3.19/Inter-SemiBoldItalic.woff2',
  'fonts/mono-special/MonoSpecial-Regular.woff2',
]);

// pathname to optional resource name
const OPTIONAL_ASSETS = new Map<string, string>([]);

export class AssetService {
  readonly #resourceService: OptionalResourceService;

  private constructor(resourceService: OptionalResourceService) {
    this.#resourceService = resourceService;

    protocol.handle('asset', async req => {
      const url = new URL(req.url);

      return this.#fetch(url.pathname);
    });
  }

  public static create(resourceService: OptionalResourceService): AssetService {
    return new AssetService(resourceService);
  }

  async #fetch(pathname: string): Promise<Response> {
    if (!pathname.startsWith('/')) {
      return new Response('invalid pathname', { status: 400 });
    }

    const path = pathname.slice(1);

    if (LOCAL_ASSETS.has(path)) {
      const stream = createReadStream(
        join(getAppRootDir(), ...path.split('/'))
      );
      return new Response(toWebStream(stream), {
        status: 200,
        headers: {
          'cache-control': 'public, max-age=2592000, immutable',
        },
      });
    }

    const optional = OPTIONAL_ASSETS.get(path);
    if (optional == null) {
      return new Response('asset not found', { status: 404 });
    }

    const asset = await this.#resourceService.getData(optional);
    if (!asset) {
      return new Response('optional asset not found', { status: 404 });
    }

    return new Response(asset, {
      status: 200,
      headers: {
        'cache-control': 'public, max-age=2592000, immutable',
      },
    });
  }
}
