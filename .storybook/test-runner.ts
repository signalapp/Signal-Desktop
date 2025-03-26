// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
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

    const dir = join(ARTIFACTS_DIR, context.id);
    await mkdir(dir, { recursive: true });

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

      await writeFile(join(dir, `${key.replace(/^icu:/, '')}.jpg`), image);
    }
  },
};
export default config;
