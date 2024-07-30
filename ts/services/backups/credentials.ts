// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { PrivateKey } from '@signalapp/libsignal-client';
import {
  BackupAuthCredential,
  BackupAuthCredentialRequestContext,
  BackupAuthCredentialResponse,
  type BackupLevel,
  GenericServerPublicParams,
} from '@signalapp/libsignal-client/zkgroup';

import * as log from '../../logging/log';
import { strictAssert } from '../../util/assert';
import { drop } from '../../util/drop';
import { isMoreRecentThan, toDayMillis } from '../../util/timestamp';
import { DAY, DurationInSeconds, HOUR } from '../../util/durations';
import { BackOff, FIBONACCI_TIMEOUTS } from '../../util/BackOff';
import type {
  BackupCdnReadCredentialType,
  BackupCredentialType,
  BackupPresentationHeadersType,
  BackupSignedPresentationType,
} from '../../types/backups';
import { toLogFormat } from '../../types/errors';
import { HTTPError } from '../../textsecure/Errors';
import type {
  GetBackupCredentialsResponseType,
  GetBackupCDNCredentialsResponseType,
} from '../../textsecure/WebAPI';
import { getBackupKey, getBackupSignatureKey } from './crypto';

export function getAuthContext(): BackupAuthCredentialRequestContext {
  return BackupAuthCredentialRequestContext.create(
    Buffer.from(getBackupKey()),
    window.storage.user.getCheckedAci()
  );
}

const FETCH_INTERVAL = 3 * DAY;

//  Credentials should be good for 24 hours, but let's play it safe.
const BACKUP_CDN_READ_CREDENTIALS_VALID_DURATION = 12 * HOUR;

export class BackupCredentials {
  private activeFetch: ReturnType<typeof this.fetch> | undefined;
  private cachedCdnReadCredentials: Record<
    number,
    BackupCdnReadCredentialType
  > = {};
  private readonly fetchBackoff = new BackOff(FIBONACCI_TIMEOUTS);

  public start(): void {
    this.scheduleFetch();
  }

  public async getForToday(): Promise<BackupSignedPresentationType> {
    const now = toDayMillis(Date.now());

    const signatureKeyBytes = getBackupSignatureKey();
    const signatureKey = PrivateKey.deserialize(Buffer.from(signatureKeyBytes));

    // Start with cache
    let credentials = window.storage.get('backupCredentials') || [];

    let result = credentials.find(({ redemptionTimeMs }) => {
      return redemptionTimeMs === now;
    });

    if (result === undefined) {
      log.info(`BackupCredentials: cache miss for ${now}`);
      credentials = await this.fetch();
      result = credentials.find(({ redemptionTimeMs }) => {
        return redemptionTimeMs === now;
      });
      strictAssert(
        result !== undefined,
        'Remote credentials do not include today'
      );
    }

    const cred = new BackupAuthCredential(
      Buffer.from(result.credential, 'base64')
    );

    const serverPublicParams = new GenericServerPublicParams(
      Buffer.from(window.getBackupServerPublicParams(), 'base64')
    );

    const presentation = cred.present(serverPublicParams).serialize();
    const signature = signatureKey.sign(presentation);

    const headers = {
      'X-Signal-ZK-Auth': presentation.toString('base64'),
      'X-Signal-ZK-Auth-Signature': signature.toString('base64'),
    };

    if (!window.storage.get('setBackupSignatureKey')) {
      log.warn('BackupCredentials: uploading signature key');

      const { server } = window.textsecure;
      strictAssert(server, 'server not available');

      await server.setBackupSignatureKey({
        headers,
        backupIdPublicKey: signatureKey.getPublicKey().serialize(),
      });

      await window.storage.put('setBackupSignatureKey', true);
    }

    return {
      headers,
      level: result.level,
    };
  }

  public async getHeadersForToday(): Promise<BackupPresentationHeadersType> {
    const { headers } = await this.getForToday();
    return headers;
  }

  public async getCDNReadCredentials(
    cdn: number
  ): Promise<GetBackupCDNCredentialsResponseType> {
    const { server } = window.textsecure;
    strictAssert(server, 'server not available');

    // Backup CDN read credentials are short-lived; we'll just cache them in memory so
    // that they get invalidated for any reason, we'll fetch new ones on app restart
    const cachedCredentialsForThisCdn = this.cachedCdnReadCredentials[cdn];

    if (
      cachedCredentialsForThisCdn &&
      isMoreRecentThan(
        cachedCredentialsForThisCdn.retrievedAtMs,
        BACKUP_CDN_READ_CREDENTIALS_VALID_DURATION
      )
    ) {
      return cachedCredentialsForThisCdn.credentials;
    }

    const headers = await this.getHeadersForToday();

    const retrievedAtMs = Date.now();
    const newCredentials = await server.getBackupCDNCredentials({
      headers,
      cdn,
    });

    this.cachedCdnReadCredentials[cdn] = {
      credentials: newCredentials,
      cdnNumber: cdn,
      retrievedAtMs,
    };

    return newCredentials;
  }

  private scheduleFetch(): void {
    const lastFetchAt = window.storage.get(
      'backupCredentialsLastRequestTime',
      0
    );
    const nextFetchAt = lastFetchAt + FETCH_INTERVAL;
    const delay = Math.max(0, nextFetchAt - Date.now());

    log.info(`BackupCredentials: scheduling fetch in ${delay}ms`);
    setTimeout(() => drop(this.runPeriodicFetch()), delay);
  }

  private async runPeriodicFetch(): Promise<void> {
    try {
      log.info('BackupCredentials: fetching');
      await this.fetch();

      await window.storage.put('backupCredentialsLastRequestTime', Date.now());

      this.fetchBackoff.reset();
      this.scheduleFetch();
    } catch (error) {
      const delay = this.fetchBackoff.getAndIncrement();
      log.error(
        'BackupCredentials: periodic fetch failed with ' +
          `error: ${toLogFormat(error)}, retrying in ${delay}ms`
      );
      setTimeout(() => this.scheduleFetch(), delay);
    }
  }

  private async fetch(): Promise<ReadonlyArray<BackupCredentialType>> {
    if (this.activeFetch) {
      return this.activeFetch;
    }

    const promise = this.doFetch();
    this.activeFetch = promise;

    try {
      return await promise;
    } finally {
      this.activeFetch = undefined;
    }
  }

  private async doFetch(): Promise<ReadonlyArray<BackupCredentialType>> {
    log.info('BackupCredentials: fetching');

    const now = Date.now();
    const startDayInMs = toDayMillis(now);
    const endDayInMs = toDayMillis(now + 6 * DAY);

    // And fetch missing credentials
    const ctx = getAuthContext();
    const { server } = window.textsecure;
    strictAssert(server, 'server not available');

    let response: GetBackupCredentialsResponseType;
    try {
      response = await server.getBackupCredentials({
        startDayInMs,
        endDayInMs,
      });
    } catch (error) {
      if (!(error instanceof HTTPError)) {
        throw error;
      }

      if (error.code !== 404) {
        throw error;
      }

      // Backup id is missing
      const request = ctx.getRequest();

      // Set it
      await server.setBackupId({
        backupAuthCredentialRequest: request.serialize(),
      });

      // And try again!
      response = await server.getBackupCredentials({
        startDayInMs,
        endDayInMs,
      });
    }

    log.info(`BackupCredentials: got ${response.credentials.length}`);

    const serverPublicParams = new GenericServerPublicParams(
      Buffer.from(window.getBackupServerPublicParams(), 'base64')
    );

    const result = new Array<BackupCredentialType>();

    const issuedTimes = new Set<number>();
    for (const { credential: buf, redemptionTime } of response.credentials) {
      const credentialRes = new BackupAuthCredentialResponse(Buffer.from(buf));

      const redemptionTimeMs = DurationInSeconds.toMillis(redemptionTime);
      strictAssert(
        startDayInMs <= redemptionTimeMs,
        'Invalid credential response redemption time, too early'
      );
      strictAssert(
        redemptionTimeMs <= endDayInMs,
        'Invalid credential response redemption time, too late'
      );

      strictAssert(
        !issuedTimes.has(redemptionTimeMs),
        'Invalid credential response redemption time, duplicate'
      );
      issuedTimes.add(redemptionTimeMs);

      const credential = ctx.receive(
        credentialRes,
        redemptionTime,
        serverPublicParams
      );

      result.push({
        credential: credential.serialize().toString('base64'),
        level: credential.getBackupLevel(),
        redemptionTimeMs,
      });
    }

    // Add cached credentials that are still in the date range, and not in
    // the response.
    const cachedCredentials = window.storage.get('backupCredentials') || [];
    for (const cached of cachedCredentials) {
      const { redemptionTimeMs } = cached;
      if (
        !(startDayInMs <= redemptionTimeMs && redemptionTimeMs <= endDayInMs)
      ) {
        continue;
      }

      if (issuedTimes.has(redemptionTimeMs)) {
        continue;
      }
      result.push(cached);
    }

    result.sort((a, b) => a.redemptionTimeMs - b.redemptionTimeMs);
    await window.storage.put('backupCredentials', result);

    const startMs = result[0].redemptionTimeMs;
    const endMs = result[result.length - 1].redemptionTimeMs;
    log.info(`BackupCredentials: saved [${startMs}, ${endMs}]`);

    strictAssert(result.length === 7, 'Expected one week of credentials');

    return result;
  }

  public async getBackupLevel(): Promise<BackupLevel> {
    return (await this.getForToday()).level;
  }

  // Called when backup tier changes or when userChanged event
  public async clearCache(): Promise<void> {
    this.cachedCdnReadCredentials = {};
    await window.storage.put('backupCredentials', []);
  }
}
