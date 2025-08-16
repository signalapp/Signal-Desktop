// Copyright 2016 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce, isEqual, isNumber } from 'lodash';

import { createLogger } from '../logging/log';

import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import { isInPast, isMoreRecentThan } from '../util/timestamp';
import { getMessageQueueTime } from '../util/getMessageQueueTime';
import { drop } from '../util/drop';
import { DataReader, DataWriter } from '../sql/Client';
import {
  findNextProfileEvent,
  redactNotificationProfileId,
  type NotificationProfileType,
} from '../types/NotificationProfile';
import {
  getCurrentState,
  getDeletedProfiles,
  getOverride,
  getProfiles,
} from '../state/selectors/notificationProfiles';
import { safeSetTimeout } from '../util/timeout';

const log = createLogger('notificationProfilesService');

export class NotificationProfilesService {
  #timeout?: ReturnType<typeof setTimeout> | null;
  #debouncedRefreshNextEvent = debounce(this.#refreshNextEvent, 1000);

  update(): void {
    drop(this.#debouncedRefreshNextEvent());
  }

  async #refreshNextEvent() {
    log.info('notificationProfileService: starting');

    const { updateCurrentState, updateOverride, profileWasRemoved } =
      window.reduxActions.notificationProfiles;

    const state = window.reduxStore.getState();
    const profiles = getProfiles(state);
    const previousCurrentState = getCurrentState(state);
    const deletedProfiles = getDeletedProfiles(state);
    let override = getOverride(state);

    if (deletedProfiles.length) {
      log.info(
        `notificationProfileService: Checking ${deletedProfiles.length} profiles marked as deleted`
      );
    }
    await Promise.all(
      deletedProfiles.map(async profile => {
        const { id, deletedAtTimestampMs } = profile;
        if (!deletedAtTimestampMs) {
          log.warn(
            `notificationProfileService: Deleted profile ${redactNotificationProfileId(id)} had no deletedAtTimestampMs`
          );
          return;
        }

        if (isMoreRecentThan(deletedAtTimestampMs, getMessageQueueTime())) {
          return;
        }

        log.info(
          `notificationProfileService: Removing expired profile ${redactNotificationProfileId(id)}, deleted at ${new Date(deletedAtTimestampMs).toISOString()}`
        );
        await DataWriter.deleteNotificationProfileById(id);
        profileWasRemoved(id);
      })
    );

    const time = Date.now();
    if (
      previousCurrentState.type === 'willDisable' &&
      previousCurrentState.clearEnableOverride &&
      isInPast(previousCurrentState.willDisableAt - 1)
    ) {
      if (
        override?.enabled &&
        override.enabled.profileId === previousCurrentState.activeProfile &&
        (!override.enabled.endsAtMs ||
          override.enabled.endsAtMs === previousCurrentState.willDisableAt)
      ) {
        log.info('notificationProfileService: Clearing manual enable override');
        override = undefined;
        updateOverride(undefined);
      } else {
        log.info(
          'notificationProfileService: Tried to clear manual enable override, but it did not match previous override'
        );
      }
    } else if (
      previousCurrentState.type === 'willEnable' &&
      previousCurrentState.clearDisableOverride &&
      isInPast(previousCurrentState.willEnableAt - 1)
    ) {
      if (
        override?.disabledAtMs &&
        override.disabledAtMs < previousCurrentState.willEnableAt
      ) {
        log.info(
          'notificationProfileService: Clearing manual disable override'
        );
        override = undefined;
        updateOverride(undefined);
      } else {
        log.info(
          'notificationProfileService: Tried to clear manual disable override, but it did not match previous override'
        );
      }
    }

    log.info('notificationProfileService: finding next profile event');
    const currentState = findNextProfileEvent({
      override,
      profiles,
      time,
    });

    if (!isEqual(previousCurrentState, currentState)) {
      log.info(
        'notificationProfileService: next profile event has changed, updating redux'
      );
      updateCurrentState(currentState);
    }

    let nextCheck: number | undefined;
    if (currentState.type === 'willDisable') {
      nextCheck = currentState.willDisableAt;
    } else if (currentState.type === 'willEnable') {
      nextCheck = currentState.willEnableAt;
    }

    clearTimeoutIfNecessary(this.#timeout);
    this.#timeout = undefined;

    if (!isNumber(nextCheck)) {
      log.info(
        'notificationProfileService: no future event found. setting no timeout'
      );
      return;
    }

    const wait = Date.now() - nextCheck;
    log.info(
      `notificationProfileService: next check ${new Date(nextCheck).toISOString()};` +
        ` waiting ${wait}ms`
    );

    this.#timeout = safeSetTimeout(this.#refreshNextEvent.bind(this), wait, {
      clampToMax: true,
    });
  }
}

export function initialize(): void {
  // if (instance) {
  //   log.warn('NotificationProfileService is already initialized!');
  //   return;
  // }
  // instance = new NotificationProfilesService();
}

export function update(): void {
  // if (!instance) {
  //   throw new Error('NotificationProfileService not yet initialized!');
  // }
  // instance.update();
}

let cachedProfiles: ReadonlyArray<NotificationProfileType> | undefined;

export async function loadCachedProfiles(): Promise<void> {
  cachedProfiles = await DataReader.getAllNotificationProfiles();
}
export function getCachedProfiles(): ReadonlyArray<NotificationProfileType> {
  const profiles = cachedProfiles;

  if (profiles == null) {
    throw new Error('getCachedProfiles: Cache is empty!');
  }
  cachedProfiles = undefined;

  return profiles;
}

// let instance: NotificationProfilesService;
