// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';

import { Bootstrap } from './bootstrap';

const debug = createDebug('mock:test:setup-ci');

// Sadly, we can reduce flakiness in CI by launching the app once first
export async function mochaGlobalSetup(): Promise<void> {
  if (!process.env.CI) {
    return;
  }

  debug('Launching app before running all tests');
  const bootstrap = new Bootstrap();
  await bootstrap.init();

  try {
    const app = await bootstrap.link();

    debug('Closing app before running all tests');
    await app.close();
    await bootstrap.teardown();
    debug('Done');
  } catch (error) {
    await bootstrap.saveLogs();
    throw error;
  }
}
