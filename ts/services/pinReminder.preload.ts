// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { createLogger } from '../logging/log.std.ts';
import { DAY, WEEK } from '../util/durations/index.std.ts';
import { strictAssert } from '../util/assert.std.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary.std.ts';
import { PinReminderState } from '../types/globalModals.std.ts';
import { safeSetTimeout } from '../util/timeout.std.ts';
import { drop } from '../util/drop.std.ts';
import * as Registration from '../util/registration.preload.ts';
import { normalizePin } from '../util/normalizePin.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';

const log = createLogger('pinReminder');

const STORAGE_KEY_LAST_REMINDER_TIME = 'pinReminderLastCompleted';
const STORAGE_KEY_NEXT_INTERVAL = 'pinReminderNextInterval';

const THREE_DAYS = 3 * DAY;
const TWO_WEEKS = 2 * WEEK;
const FOUR_WEEKS = 4 * WEEK;

class PinReminderService {
  #isInitialized = false;
  #nextCheckTimeout: NodeJS.Timeout | null = null;
  #wasWrongPinEntered = false;

  init(): void {
    if (this.#isInitialized) {
      return;
    }

    log.info('Init');

    this.#isInitialized = true;
    drop(this.check());
  }

  async check(): Promise<void> {
    const isEnabled = this.#isEnabled();
    if (!isEnabled) {
      return;
    }

    const lastReminderTime = await this.#getOrInitLastReminderTime();
    const nextInterval = itemStorage.get(
      STORAGE_KEY_NEXT_INTERVAL,
      this.#defaultInterval
    );

    const nextReminder = lastReminderTime + nextInterval;
    if (nextReminder <= Date.now()) {
      log.info('Showing pin reminder');
      window.reduxActions.globalModals.maybeShowPinReminder();

      // Next timeout is set after interacting with reminder or on restart
      return;
    }

    this.#scheduleCheck(nextReminder);
  }

  // ignoreWrongGuess lets you check pin entry without counting wrong attempts.
  handlePinEntry(pin: string, ignoreWrongGuess = false): boolean {
    const svrPin = itemStorage.get('svrPin');
    strictAssert(svrPin, 'pin must be in itemStorage');

    if (normalizePin(svrPin) === normalizePin(pin)) {
      drop(this.#resolveReminder('success'));
      return true;
    }

    if (!ignoreWrongGuess) {
      this.#wasWrongPinEntered = true;
    }

    return false;
  }

  async handlePinRemindersSettingChanged(
    hasPinReminders: boolean
  ): Promise<void> {
    clearTimeoutIfNecessary(this.#nextCheckTimeout);

    if (hasPinReminders) {
      await itemStorage.put(STORAGE_KEY_NEXT_INTERVAL, this.#defaultInterval);
      await this.check();
    } else {
      window.reduxActions.globalModals.togglePinReminder(PinReminderState.None);
    }
  }

  handleSkipReminder(): void {
    drop(this.#resolveReminder('skip'));
  }

  // Private
  get #defaultInterval(): number {
    return THREE_DAYS;
  }

  async #resolveReminder(reason: 'success' | 'skip'): Promise<void> {
    log.info(`#resolveReminder: reason=${reason}`);
    const now = Date.now();
    const nextInterval = this.#getNextInterval({ isSkip: reason === 'skip' });
    await itemStorage.put(STORAGE_KEY_LAST_REMINDER_TIME, now);
    await itemStorage.put(STORAGE_KEY_NEXT_INTERVAL, nextInterval);

    // Reset wrong pin state for next reminder
    this.#wasWrongPinEntered = false;
    this.#scheduleCheck(now + nextInterval);

    window.reduxActions.globalModals.togglePinReminder(PinReminderState.None);
    if (reason === 'success') {
      window.reduxActions.toast.showToast({
        toastType: ToastType.PinReminderCompleted,
      });
    }
  }

  #getNextInterval({ isSkip }: { isSkip: boolean }): number {
    const currentInterval = itemStorage.get(
      STORAGE_KEY_NEXT_INTERVAL,
      this.#defaultInterval
    );
    if (isSkip && !this.#wasWrongPinEntered) {
      return currentInterval;
    }

    const shorter = this.#wasWrongPinEntered;
    switch (currentInterval) {
      case THREE_DAYS:
        return shorter ? THREE_DAYS : WEEK;
      case WEEK:
        return shorter ? THREE_DAYS : TWO_WEEKS;
      case TWO_WEEKS:
        return shorter ? WEEK : FOUR_WEEKS;
      case FOUR_WEEKS:
        return shorter ? TWO_WEEKS : FOUR_WEEKS;
      default:
        return shorter ? THREE_DAYS : WEEK;
    }
  }

  async #getOrInitLastReminderTime(): Promise<number> {
    const lastReminderTime = itemStorage.get(STORAGE_KEY_LAST_REMINDER_TIME);
    if (lastReminderTime === undefined) {
      log.info('Initializing last reminder time');
      const now = Date.now();
      await itemStorage.put(STORAGE_KEY_LAST_REMINDER_TIME, now);
      return now;
    }

    return lastReminderTime;
  }

  #isEnabled(): boolean {
    return (
      Registration.isDone() &&
      window.ConversationController.areWePrimaryDevice() &&
      itemStorage.get('pinReminders', true)
    );
  }

  #scheduleCheck(nextReminder: number): void {
    log.info(
      'Scheduling next reminder for',
      new Date(nextReminder).toISOString()
    );
    clearTimeoutIfNecessary(this.#nextCheckTimeout);
    this.#nextCheckTimeout = safeSetTimeout(
      () => this.check(),
      nextReminder - Date.now()
    );
  }
}

export const pinReminderService = new PinReminderService();
