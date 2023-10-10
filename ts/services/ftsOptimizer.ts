// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce } from 'lodash';

import { SECOND } from '../util/durations';
import { sleep } from '../util/sleep';
import { drop } from '../util/drop';
import { isProduction } from '../util/version';
import dataInterface from '../sql/Client';
import type { FTSOptimizationStateType } from '../sql/Interface';
import * as log from '../logging/log';

const INTERACTIVITY_DELAY_MS = 50;

class FTSOptimizer {
  private isRunning = false;

  public async run(): Promise<void> {
    if (!isProduction(window.getVersion())) {
      log.info('ftsOptimizer: not running when not in production');
      return;
    }

    if (this.isRunning) {
      return;
    }
    this.isRunning = true;

    log.info('ftsOptimizer: starting');

    let state: FTSOptimizationStateType | undefined;

    const start = Date.now();

    try {
      do {
        if (state !== undefined) {
          // eslint-disable-next-line no-await-in-loop
          await sleep(INTERACTIVITY_DELAY_MS);
        }

        // eslint-disable-next-line no-await-in-loop
        state = await dataInterface.optimizeFTS(state);
      } while (!state?.done);
    } finally {
      this.isRunning = false;
    }

    const duration = Date.now() - start;

    if (!state) {
      log.warn('ftsOptimizer: no final state');
      return;
    }

    log.info(`ftsOptimizer: took ${duration}ms and ${state.steps} steps`);
  }
}

const optimizer = new FTSOptimizer();

export const optimizeFTS = (): void => {
  drop(optimizer.run());
};

export const scheduleOptimizeFTS = debounce(optimizeFTS, SECOND, {
  maxWait: 5 * SECOND,
});
