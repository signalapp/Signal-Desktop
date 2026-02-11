// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.js';
import * as Errors from '../types/errors.std.js';
import {
  getMegaphoneLastSnoozeDurationMs,
  MegaphoneCtaId,
  SNOOZE_DEFAULT_DURATION,
  type RemoteMegaphoneType,
  type VisibleRemoteMegaphoneType,
} from '../types/Megaphone.std.js';
import { DAY, HOUR } from '../util/durations/index.std.js';
import { DataReader, DataWriter } from '../sql/Client.preload.js';
import { drop } from '../util/drop.std.js';
import { isMockEnvironment } from '../environment.std.js';
import { isEnabled } from '../RemoteConfig.dom.js';
import { safeSetTimeout } from '../util/timeout.std.js';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';
import { isMoreRecentThan } from '../util/timestamp.std.js';
import { isFeaturedEnabledNoRedux } from '../util/isFeatureEnabled.dom.js';
import { maybeHydrateDonationConfigCache } from '../util/subscriptionConfiguration.preload.js';

const log = createLogger('megaphoneService');

const CHECK_INTERVAL = 12 * HOUR;
const CONDITIONAL_STANDARD_DONATE_DEVICE_AGE = 7 * DAY;

let nextCheckTimeout: NodeJS.Timeout | null;

// Entrypoint

export function initMegaphoneCheckService(): void {
  if (nextCheckTimeout) {
    log.warn('initMegaphoneCheckService: already started');
    return;
  }

  log.info('initMegaphoneCheckService: starting');
  nextCheckTimeout = safeSetTimeout(() => {
    drop(runMegaphoneCheck());
  }, CHECK_INTERVAL);

  drop(runMegaphoneCheck());
}

export async function runMegaphoneCheck(): Promise<void> {
  try {
    if (!isRemoteMegaphoneEnabled()) {
      log.info('runMegaphoneCheck: not enabled, skipping');
      return;
    }

    const megaphones = await DataReader.getAllMegaphones();

    log.info(
      `runMegaphoneCheck: Checking ${megaphones.length} locally saved megaphones`
    );
    for (const megaphone of megaphones) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await processMegaphone(megaphone);
      } catch (error) {
        log.error(
          `runMegaphoneCheck: Error processing ${megaphone.id}`,
          Errors.toLogFormat(error)
        );
      }
    }
  } finally {
    clearTimeoutIfNecessary(nextCheckTimeout);
    nextCheckTimeout = safeSetTimeout(() => {
      drop(runMegaphoneCheck());
    }, CHECK_INTERVAL);
  }
}

export function isRemoteMegaphoneEnabled(): boolean {
  return isFeaturedEnabledNoRedux({
    betaKey: 'desktop.remoteMegaphone.beta',
    prodKey: 'desktop.remoteMegaphone.prod',
  });
}

export function isConditionalActive(conditionalId: string | null): boolean {
  if (conditionalId == null) {
    return true;
  }

  if (conditionalId === 'standard_donate') {
    const deviceCreatedAt = itemStorage.user.getDeviceCreatedAt();
    if (
      !deviceCreatedAt ||
      isMoreRecentThan(deviceCreatedAt, CONDITIONAL_STANDARD_DONATE_DEVICE_AGE)
    ) {
      return false;
    }

    const me = window.ConversationController.getOurConversation();
    if (!me) {
      log.error(
        "isConditionalActive: Can't check badges because our conversation not available"
      );
      return false;
    }

    const hasBadges = me.attributes.badges && me.attributes.badges.length > 0;
    return !hasBadges;
  }

  if (conditionalId === 'internal_user') {
    return isEnabled('desktop.internalUser');
  }

  if (conditionalId === 'test') {
    return isMockEnvironment();
  }

  log.error(`isConditionalActive: Invalid value ${conditionalId}`);
  return false;
}

// Private

async function processMegaphone(megaphone: RemoteMegaphoneType): Promise<void> {
  const { id } = megaphone;

  if (isMegaphoneDeletable(megaphone)) {
    log.info(`processMegaphone: Deleting ${id}`);
    await DataWriter.deleteMegaphone(id);
    window.reduxActions.megaphones.removeVisibleMegaphone(id);
    return;
  }

  if (isMegaphoneShowable(megaphone)) {
    if (
      megaphone.primaryCtaId === 'donate' ||
      megaphone.secondaryCtaId === 'donate'
    ) {
      log.info(
        'processMegaphone: Megaphone ctaId donate, prefetching donation amount config'
      );
      drop(maybeHydrateDonationConfigCache());
    }

    log.info(`processMegaphone: Showing ${id}`);
    window.reduxActions.megaphones.addVisibleMegaphone(megaphone);
  }
}

export function isMegaphoneDeletable(megaphone: RemoteMegaphoneType): boolean {
  return Date.now() > megaphone.dontShowAfterEpochMs;
}

export function isMegaphoneCtaIdValid(
  ctaId: string | null
): ctaId is MegaphoneCtaId {
  return (
    ctaId == null ||
    Object.values(MegaphoneCtaId).includes(ctaId as MegaphoneCtaId)
  );
}

export function isMegaphoneShowable(
  megaphone: RemoteMegaphoneType
): megaphone is VisibleRemoteMegaphoneType {
  const nowMs = Date.now();
  const {
    dontShowAfterEpochMs,
    isFinished,
    snoozedAt,
    primaryCtaId,
    secondaryCtaId,
  } = megaphone;

  if (isFinished || nowMs > dontShowAfterEpochMs) {
    return false;
  }

  if (
    !isMegaphoneCtaIdValid(primaryCtaId) ||
    !isMegaphoneCtaIdValid(secondaryCtaId)
  ) {
    log.warn(
      `Skipping megaphone ${megaphone.id} with unknown ctaId:`,
      primaryCtaId,
      secondaryCtaId
    );
    return false;
  }

  if (!isConditionalActive(megaphone.conditionalId)) {
    return false;
  }

  if (snoozedAt) {
    let snoozeDuration;
    try {
      snoozeDuration = getMegaphoneLastSnoozeDurationMs(megaphone);
    } catch (error) {
      log.error(
        'isMegaphoneShowable() failed to parse snooze config',
        Errors.toLogFormat(error)
      );
      snoozeDuration = SNOOZE_DEFAULT_DURATION;
    }
    if (nowMs < snoozedAt + snoozeDuration) {
      return false;
    }
  }

  return true;
}
