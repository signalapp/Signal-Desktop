// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { mkdir, writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  type TestRunnerConfig,
  waitForPageReady,
} from '@storybook/test-runner';

const SECOND = 1000;

const { ARTIFACTS_DIR } = process.env;

const config: TestRunnerConfig = {
  async preVisit(page) {
    if (!ARTIFACTS_DIR) {
      return;
    }

    await page.evaluate('window.SignalContext._skipAnimation()');
    await page.evaluate('window.SignalContext._trackICUStrings()');
  },
  async postVisit(page, context) {
    if (context.hasFailure) {
      return;
    }
    if (!ARTIFACTS_DIR) {
      return;
    }

    await waitForPageReady(page);

    const result = await page.evaluate(
      'window.SignalContext._stopTrackingICUStrings()'
    );

    // No strings - no file
    if (result.length === 0) {
      return;
    }

    const storeDir = join(ARTIFACTS_DIR, 'images');
    await mkdir(storeDir, { recursive: true });

    const componentDir = join(ARTIFACTS_DIR, 'components', context.id);
    await mkdir(componentDir, { recursive: true });

    const saves = new Array<Promise<void>>();
    for (const [key, value] of result) {
      const locator = page
        .getByText(value)
        .or(page.getByTitle(value))
        .or(page.getByLabel(value));

      if (await locator.count()) {
        const first = locator.first();

        try {
          await first.focus({ timeout: SECOND });
        } catch {
          // Opportunistic
        }
        try {
          if (await first.isVisible()) {
            await first.scrollIntoViewIfNeeded({ timeout: SECOND });
          }
        } catch {
          // Opportunistic
        }
      }

      const image = await page.screenshot({
        animations: 'disabled',
        fullPage: true,
        mask: [locator],
        // Semi-transparent ultramarine
        maskColor: 'rgba(44, 107, 273, 0.3)',
        type: 'jpeg',
        quality: 95,
      });

      const digest = createHash('sha256').update(image).digest('hex');
      const storeFile = join(storeDir, `${digest}.jpg`);
      const targetFile = join(componentDir, `${key.replace(/^icu:/, '')}.jpg`);

      saves.push(
        (async () => {
          try {
            await writeFile(storeFile, image, {
              // Fail if exists
              flags: 'wx',
            });
          } catch (error) {
            if (error.code !== 'EEXIST') {
              throw error;
            }
          }
          await symlink(storeFile, targetFile);
        })()
      );
    }

    await Promise.all(saves);
  },
};
export default config;
