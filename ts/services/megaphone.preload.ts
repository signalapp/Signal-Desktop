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
import { HOUR } from '../util/durations/index.std.js';
import { DataReader, DataWriter } from '../sql/Client.preload.js';
import { drop } from '../util/drop.std.js';
import {
  Environment,
  getEnvironment,
  isMockEnvironment,
} from '../environment.std.js';
import { isEnabled } from '../RemoteConfig.dom.js';
import { safeSetTimeout } from '../util/timeout.std.js';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary.std.js';

const log = createLogger('megaphoneService');

const CHECK_INTERVAL = 12 * HOUR;

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
  const env = getEnvironment();

  if (
    env === Environment.Development ||
    env === Environment.Test ||
    env === Environment.Staging ||
    isMockEnvironment() ||
    isEnabled('desktop.internalUser')
  ) {
    return true;
  }

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
