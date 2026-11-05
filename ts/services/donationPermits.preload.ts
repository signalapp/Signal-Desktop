// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  DonationPermit,
  DonationPermitRequestContext,
  ServerPublicParams,
} from '@signalapp/libsignal-client/zkgroup.js';
import { z } from 'zod';

import * as Bytes from '../Bytes.std.ts';
import { strictAssert } from '../util/assert.std.ts';
import { isInFuture, isInPast } from '../util/timestamp.std.ts';
import { createDonationPermits } from '../textsecure/WebAPI.preload.ts';
import { createLogger } from '../logging/log.std.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { safeParseStrict, safeParseUnknown } from '../util/schemas.std.ts';
import { DAY } from '../util/durations/index.std.ts';

const log = createLogger('donationPermits');

const MAX_PERMIT_CACHE_TIME = DAY;
const PERMIT_COUNT_PER_REQUEST = 3;
const PERMIT_STORAGE_KEY = 'donationPermits';

const permitStorageSchema = z.object({
  permitsBase64: z.array(z.string()),
  expiresAt: z.number(),
});

let cachedPermits: Array<DonationPermit> = [];
let cachedPermitsExpiresAt: number | undefined;
let storageLoaded = false;

/**
 * @throws {Error} If a permit could not be fetched.
 */
export async function fetchDonationPermit(): Promise<DonationPermit> {
  if (!storageLoaded) {
    loadPermitsFromStorage();
  }

  if (isCacheRefreshNeeded()) {
    log.info(`Requesting ${PERMIT_COUNT_PER_REQUEST} donation permits`);

    const { permits, expiresAt } = await requestDonationPermits();

    cachedPermitsExpiresAt = expiresAt;
    cachedPermits = permits;
    log.info(`Got ${permits.length} permits expiring ${expiresAt}`);
  } else {
    log.info('Using saved donation permit');
  }

  const permit = cachedPermits.shift();
  strictAssert(permit, 'Donation permit is required');

  await savePermitsToStorage({
    permits: cachedPermits,
    expiresAt: cachedPermitsExpiresAt,
  });

  return permit;
}

function isCacheRefreshNeeded(): boolean {
  return (
    cachedPermits.length === 0 ||
    cachedPermitsExpiresAt == null ||
    isInPast(cachedPermitsExpiresAt)
  );
}

async function requestDonationPermits(): Promise<{
  permits: Array<DonationPermit>;
  expiresAt: number;
}> {
  const serverPublicParams = new ServerPublicParams(
    Bytes.fromBase64(window.getServerPublicParams())
  );
  const context = DonationPermitRequestContext.forCount(
    PERMIT_COUNT_PER_REQUEST
  );

  const permits = await createDonationPermits({
    requestContext: context,
    serverParams: serverPublicParams,
  });
  const [firstPermit] = permits;
  strictAssert(firstPermit, 'Donation permits must be present');

  const expiresAt = Math.min(
    firstPermit.expiration.getTime(),
    new Date().getTime() + MAX_PERMIT_CACHE_TIME
  );
  strictAssert(isInFuture(expiresAt), 'Expiry must be in future');

  return { permits, expiresAt };
}

function loadPermitsFromStorage(): void {
  const permitsJson = itemStorage.get(PERMIT_STORAGE_KEY);
  if (!permitsJson) {
    return;
  }

  try {
    const permitsData = JSON.parse(permitsJson) as unknown;
    const result = safeParseUnknown(permitStorageSchema, permitsData);
    if (!result.success) {
      throw new Error(
        `Could not load permits from storage: ${z.prettifyError(result.error)}`
      );
    }

    const { permitsBase64, expiresAt } = result.data;
    const permits = permitsBase64.map(
      permitBase64 => new DonationPermit(Bytes.fromBase64(permitBase64))
    );

    cachedPermits = permits;
    cachedPermitsExpiresAt = expiresAt;
    storageLoaded = true;

    log.info(
      `Loaded from storage: ${permits.length} permits, expiring ${expiresAt}`
    );
  } catch (error) {
    log.error(error);
  }
}

async function savePermitsToStorage({
  permits,
  expiresAt,
}: {
  permits: Array<DonationPermit>;
  expiresAt: number | undefined;
}): Promise<void> {
  if (!expiresAt) {
    log.warn('expiresAt is required to save permits to storage');
    return;
  }

  try {
    const permitsBase64 = permits.map(permit =>
      Bytes.toBase64(permit.serialize())
    );
    const storageValue = { permitsBase64, expiresAt };
    const result = safeParseStrict(permitStorageSchema, storageValue);
    if (!result.success) {
      throw new Error(
        `Permit storage validation failed: ${z.prettifyError(result.error)}`
      );
    }

    await itemStorage.put(PERMIT_STORAGE_KEY, JSON.stringify(storageValue));
    log.info(
      `Saved to storage: ${permits.length} permits, expiring ${expiresAt}`
    );
  } catch (error) {
    log.error(error);
  }
}
