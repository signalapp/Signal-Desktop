// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';

import type { NavTab } from '../state/ducks/nav';
import { SECOND } from '../util/durations';
import { sleep } from '../util/sleep';

export enum BeforeNavigateResponse {
  Noop = 'Noop',
  MadeChanges = 'MadeChanges',
  WaitedForUser = 'WaitedForUser',
  CancelNavigation = 'CancelNavigation',
  TimedOut = 'TimedOut',
}
export type BeforeNavigateCallback = (
  newTab: NavTab
) => Promise<BeforeNavigateResponse>;
export type BeforeNavigateEntry = {
  name: string;
  callback: BeforeNavigateCallback;
};

export class BeforeNavigateService {
  #beforeNavigateCallbacks = new Set<BeforeNavigateEntry>();

  private findMatchingEntry(
    entry: BeforeNavigateEntry
  ): BeforeNavigateEntry | undefined {
    const { callback } = entry;
    return Array.from(this.#beforeNavigateCallbacks).find(
      item => item.callback === callback
    );
  }

  registerCallback(entry: BeforeNavigateEntry): void {
    const logId = 'registerCallback';
    const existing = this.findMatchingEntry(entry);

    if (existing) {
      log.warn(
        `${logId}: Overwriting duplicate callback for entry ${entry.name}`
      );
      this.#beforeNavigateCallbacks.delete(existing);
    }

    this.#beforeNavigateCallbacks.add(entry);
  }
  unregisterCallback(entry: BeforeNavigateEntry): void {
    const logId = 'unregisterCallback';
    const existing = this.findMatchingEntry(entry);

    if (!existing) {
      log.warn(
        `${logId}: Didn't find matching callback for entry ${entry.name}`
      );
      return;
    }

    this.#beforeNavigateCallbacks.delete(existing);
  }

  async shouldCancelNavigation({
    context,
    newTab,
  }: {
    context: string;
    newTab: NavTab;
  }): Promise<boolean> {
    const logId = `shouldCancelNavigation/${context}`;
    const entries = Array.from(this.#beforeNavigateCallbacks);

    for (let i = 0, max = entries.length; i < max; i += 1) {
      const entry = entries[i];
      // eslint-disable-next-line no-await-in-loop
      const response = await Promise.race([
        entry.callback(newTab),
        timeOutAfter(5 * SECOND),
      ]);
      if (response === BeforeNavigateResponse.Noop) {
        continue;
      }

      log.info(`${logId}: ${entry.name} returned result ${response}`);
      if (
        response === BeforeNavigateResponse.CancelNavigation ||
        response === BeforeNavigateResponse.TimedOut
      ) {
        return true;
      }
    }

    return false;
  }
}

async function timeOutAfter(ms: number): Promise<BeforeNavigateResponse> {
  await sleep(ms);
  return BeforeNavigateResponse.TimedOut;
}

export const beforeNavigateService = new BeforeNavigateService();
