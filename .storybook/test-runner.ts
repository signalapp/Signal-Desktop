// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type TestRunnerConfig,
  waitForPageReady,
} from '@storybook/test-runner';

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

    const image = await page.screenshot({ fullPage: true });

    const dir = join(ARTIFACTS_DIR, context.id);
    await mkdir(dir, { recursive: true });

    await Promise.all([
      writeFile(join(dir, 'screenshot.png'), image),
      writeFile(join(dir, 'strings.json'), JSON.stringify(result)),
    ]);
  },
};
export default config;
