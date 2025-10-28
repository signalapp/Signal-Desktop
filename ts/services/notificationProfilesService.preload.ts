// Copyright 2016 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

import { createLogger } from '../logging/log.std.js';

import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary.std.js';
import { isInPast, isMoreRecentThan } from '../util/timestamp.std.js';
import { getMessageQueueTime } from '../util/getMessageQueueTime.dom.js';
import { drop } from '../util/drop.std.js';
import { DataReader, DataWriter } from '../sql/Client.preload.js';
import {
  findNextProfileEvent,
  redactNotificationProfileId,
} from '../types/NotificationProfile.std.js';
import {
  getActiveProfile,
  getCurrentState,
  getDeletedProfiles,
  getOverride,
  getProfiles,
} from '../state/selectors/notificationProfiles.dom.js';
import { safeSetTimeout } from '../util/timeout.std.js';
import { ToastType } from '../types/Toast.dom.js';
import { toLogFormat } from '../types/errors.std.js';

import type {
  NextProfileEvent,
  NotificationProfileType,
} from '../types/NotificationProfile.std.js';

const { debounce, isEqual, isNumber } = lodash;

const log = createLogger('notificationProfilesService');

export class NotificationProfilesService {
  #timeout?: ReturnType<typeof setTimeout> | null;
  #debouncedRefreshNextEvent = debounce(this.#refreshNextEvent, 1000);

  update(): void {
    drop(this.#debouncedRefreshNextEvent());
  }

  fastUpdate(): void {
    drop(this.#refreshNextEvent());
  }

  async #refreshNextEvent(): Promise<void> {
    log.info('notificationProfileService: starting');

    const { updateCurrentState, updateOverride, profileWasRemoved } =
      window.reduxActions.notificationProfiles;

    const state = window.reduxStore.getState();

    // This gets everything, even if it's not being shown to user
    const allProfilesIncludingRemoteOnly = state.notificationProfiles.profiles;

    // These fetches are limited to what user can see (local-only items, if sync=OFF)
    const profiles = getProfiles(state);
    const previousCurrentState = getCurrentState(state);
    const previousActiveProfile = getActiveProfile(state);
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
        updateOverride(undefined, { fromStorageService: false });
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
        updateOverride(undefined, { fromStorageService: false });
      } else {
        log.info(
          'notificationProfileService: Tried to clear manual disable override, but it did not match previous override'
        );
      }
    }

    let currentState: NextProfileEvent;
    try {
      log.info('notificationProfileService: finding next profile event');
      currentState = findNextProfileEvent({
        override,
        profiles,
        time,
      });
    } catch (error) {
      log.warn('notificationProfileService:', toLogFormat(error));
      if (override) {
        log.warn(
          'notificationProfileService: Clearing override because something went wrong'
        );

        // This will kick off another profile update when it completes
        updateOverride(undefined, { fromStorageService: false });
      }

      return;
    }

    const currentActiveProfileId =
      currentState.type === 'willDisable' || currentState.type === 'noChange'
        ? currentState.activeProfile
        : undefined;
    const currentActiveProfile = currentActiveProfileId
      ? allProfilesIncludingRemoteOnly.find(
          item => item.id === currentActiveProfileId
        )
      : undefined;

    if (!isEqual(previousCurrentState, currentState)) {
      log.info(
        'notificationProfileService: next profile event has changed, updating redux'
      );
      updateCurrentState(currentState, currentActiveProfile);
    }

    if (previousActiveProfile?.id === currentActiveProfileId) {
      // do nothing!
      // Something has changed, but it's still the same profile
    } else if (
      previousActiveProfile &&
      currentActiveProfile &&
      previousActiveProfile.name === currentActiveProfile.name &&
      // This off-by-one timestamp is created in prepareForDisabledNotificationProfileSync
      (previousActiveProfile.createdAtMs ===
        currentActiveProfile.createdAtMs + 1 ||
        previousActiveProfile.createdAtMs + 1 ===
          currentActiveProfile.createdAtMs)
    ) {
      // do nothing!
      // We're switching to a different profile, but it's a remote/local copy. This will
      // happen whenever there's an override enabling a profile and notification profiles
      // sync is turned on/off.
    } else if (!currentActiveProfileId) {
      if (previousActiveProfile) {
        window.reduxActions.toast.showToast({
          toastType: ToastType.NotificationProfileUpdate,
          parameters: {
            enabled: false,
            name: previousActiveProfile.name,
          },
        });
      } else {
        log.warn(
          'refreshNextEvent: Unable to find just-disabled profile for toast'
        );
      }
    } else if (currentActiveProfile) {
      window.reduxActions.toast.showToast({
        toastType: ToastType.NotificationProfileUpdate,
        parameters: {
          enabled: true,
          name: currentActiveProfile.name,
        },
      });
    } else {
      log.warn(
        'refreshNextEvent: Unable to find just-enabled profile for toast'
      );
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

    const wait = nextCheck - Date.now();
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
  if (instance) {
    log.warn('NotificationProfileService is already initialized!');
    return;
  }
  instance = new NotificationProfilesService();
}

export function update(): void {
  if (!instance) {
    throw new Error('update: NotificationProfileService not yet initialized!');
  }
  instance.update();
}
export function fastUpdate(): void {
  if (!instance) {
    throw new Error(
      'fastUpdate: NotificationProfileService not yet initialized!'
    );
  }
  instance.fastUpdate();
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

let instance: NotificationProfilesService;
