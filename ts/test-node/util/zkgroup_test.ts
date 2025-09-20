// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as fs from 'node:fs';
import path from 'node:path';
import { ServerPublicParams } from '@signalapp/libsignal-client/zkgroup.js';

describe('zkgroup', () => {
  describe('serverPublicParams', () => {
    const configDir = 'config';

    for (const file of fs.readdirSync(configDir)) {
      if (!file.endsWith('.json')) {
        continue;
      }
      const contents = fs.readFileSync(path.join(configDir, file), {
        encoding: 'utf-8',
      });
      const serverPublicParamsBase64: string | undefined =
        JSON.parse(contents).serverPublicParams;

      let test: (() => void) | undefined;
      if (serverPublicParamsBase64 !== undefined) {
        test = () => {
          const serverPublicParams = new ServerPublicParams(
            Buffer.from(serverPublicParamsBase64, 'base64')
          );
          assert(serverPublicParams);
        };
      } else {
        // Mark as "pending" / skipped to show we didn't miss a file.
        test = undefined;
      }
      it(`valid in ${file}`, test);
    }
  });
});
