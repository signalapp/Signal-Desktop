// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type PrivateKey } from '@signalapp/libsignal-client';
import {
  BackupAuthCredential,
  BackupAuthCredentialRequestContext,
  BackupAuthCredentialResponse,
  type BackupLevel,
  GenericServerPublicParams,
} from '@signalapp/libsignal-client/zkgroup';
import { type BackupKey } from '@signalapp/libsignal-client/dist/AccountKeys';

import * as log from '../../logging/log';
import { strictAssert } from '../../util/assert';
import { drop } from '../../util/drop';
import { isMoreRecentThan, toDayMillis } from '../../util/timestamp';
import { DAY, DurationInSeconds, HOUR } from '../../util/durations';
import { BackOff, FIBONACCI_TIMEOUTS } from '../../util/BackOff';
import { missingCaseError } from '../../util/missingCaseError';
import {
  type BackupCdnReadCredentialType,
  type BackupCredentialWrapperType,
  type BackupPresentationHeadersType,
  type BackupSignedPresentationType,
  BackupCredentialType,
} from '../../types/backups';
import { toLogFormat } from '../../types/errors';
import { HTTPError } from '../../textsecure/Errors';
import type {
  GetBackupCredentialsResponseType,
  GetBackupCDNCredentialsResponseType,
} from '../../textsecure/WebAPI';
import {
  getBackupKey,
  getBackupMediaRootKey,
  getBackupSignatureKey,
  getBackupMediaSignatureKey,
} from './crypto';

const FETCH_INTERVAL = 3 * DAY;

//  Credentials should be good for 24 hours, but let's play it safe.
const BACKUP_CDN_READ_CREDENTIALS_VALID_DURATION = 12 * HOUR;

export class BackupCredentials {
  #activeFetch: Promise<ReadonlyArray<BackupCredentialWrapperType>> | undefined;

  #cachedCdnReadCredentials: Record<number, BackupCdnReadCredentialType> = {};

  readonly #fetchBackoff = new BackOff(FIBONACCI_TIMEOUTS);

  public start(): void {
    this.#scheduleFetch();
  }

  public async getForToday(
    credentialType: BackupCredentialType
  ): Promise<BackupSignedPresentationType> {
    const now = toDayMillis(Date.now());

    let signatureKey: PrivateKey;
    let storageKey: `setBackup${'Messages' | 'Media'}SignatureKey`;
    if (credentialType === BackupCredentialType.Messages) {
      signatureKey = getBackupSignatureKey();
      storageKey = 'setBackupMessagesSignatureKey';
    } else if (credentialType === BackupCredentialType.Media) {
      signatureKey = getBackupMediaSignatureKey();
      storageKey = 'setBackupMediaSignatureKey';
    } else {
      throw missingCaseError(credentialType);
    }

    // Start with cache
    let credentials = this.#getFromCache();

    let result = credentials.find(({ type, redemptionTimeMs }) => {
      return type === credentialType && redemptionTimeMs === now;
    });

    if (result === undefined) {
      log.info(`BackupCredentials: cache miss for ${now}`);
      credentials = await this.#fetch();
      result = credentials.find(({ type, redemptionTimeMs }) => {
        return type === credentialType && redemptionTimeMs === now;
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

    const info = { headers, level: result.level };
    if (window.storage.get(storageKey)) {
      return info;
    }

    log.warn(`BackupCredentials: uploading signature key (${storageKey})`);

    const { server } = window.textsecure;
    strictAssert(server, 'server not available');

    await server.setBackupSignatureKey({
      headers,
      backupIdPublicKey: signatureKey.getPublicKey().serialize(),
    });

    await window.storage.put(storageKey, true);

    return info;
  }

  public async getHeadersForToday(
    credentialType: BackupCredentialType
  ): Promise<BackupPresentationHeadersType> {
    const { headers } = await this.getForToday(credentialType);
    return headers;
  }

  public async getCDNReadCredentials(
    cdn: number,
    credentialType: BackupCredentialType
  ): Promise<GetBackupCDNCredentialsResponseType> {
    const { server } = window.textsecure;
    strictAssert(server, 'server not available');

    // Backup CDN read credentials are short-lived; we'll just cache them in memory so
    // that they get invalidated for any reason, we'll fetch new ones on app restart
    const cachedCredentialsForThisCdn = this.#cachedCdnReadCredentials[cdn];

    if (
      cachedCredentialsForThisCdn &&
      isMoreRecentThan(
        cachedCredentialsForThisCdn.retrievedAtMs,
        BACKUP_CDN_READ_CREDENTIALS_VALID_DURATION
      )
    ) {
      return cachedCredentialsForThisCdn.credentials;
    }

    const headers = await this.getHeadersForToday(credentialType);

    const retrievedAtMs = Date.now();
    const newCredentials = await server.getBackupCDNCredentials({
      headers,
      cdn,
    });

    this.#cachedCdnReadCredentials[cdn] = {
      credentials: newCredentials,
      cdnNumber: cdn,
      retrievedAtMs,
    };

    return newCredentials;
  }

  #scheduleFetch(): void {
    const lastFetchAt = window.storage.get(
      'backupCombinedCredentialsLastRequestTime',
      0
    );
    const nextFetchAt = lastFetchAt + FETCH_INTERVAL;
    const delay = Math.max(0, nextFetchAt - Date.now());

    log.info(`BackupCredentials: scheduling fetch in ${delay}ms`);
    setTimeout(() => drop(this.#runPeriodicFetch()), delay);
  }

  async #runPeriodicFetch(): Promise<void> {
    try {
      log.info('BackupCredentials: run periodic fetch');
      await this.#fetch();

      const now = Date.now();
      await window.storage.put('backupCombinedCredentialsLastRequestTime', now);

      this.#fetchBackoff.reset();
      this.#scheduleFetch();
    } catch (error) {
      const delay = this.#fetchBackoff.getAndIncrement();
      log.error(
        'BackupCredentials: periodic fetch failed with ' +
          `error: ${toLogFormat(error)}, retrying in ${delay}ms`
      );
      setTimeout(() => this.#scheduleFetch(), delay);
    }
  }

  async #fetch(): Promise<ReadonlyArray<BackupCredentialWrapperType>> {
    if (this.#activeFetch) {
      return this.#activeFetch;
    }

    const promise = this.#doFetch();
    this.#activeFetch = promise;

    try {
      return await promise;
    } finally {
      this.#activeFetch = undefined;
    }
  }

  async #doFetch(): Promise<ReadonlyArray<BackupCredentialWrapperType>> {
    log.info('BackupCredentials: fetching');

    const now = Date.now();
    const startDayInMs = toDayMillis(now);
    const endDayInMs = toDayMillis(now + 6 * DAY);

    // And fetch missing credentials
    const messagesCtx = this.#getAuthContext(BackupCredentialType.Messages);
    const mediaCtx = this.#getAuthContext(BackupCredentialType.Media);
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
      const messagesRequest = messagesCtx.getRequest();
      const mediaRequest = mediaCtx.getRequest();

      // Set it
      await server.setBackupId({
        messagesBackupAuthCredentialRequest: messagesRequest.serialize(),
        mediaBackupAuthCredentialRequest: mediaRequest.serialize(),
      });

      // And try again!
      response = await server.getBackupCredentials({
        startDayInMs,
        endDayInMs,
      });
    }

    const { messages: messageCredentials, media: mediaCredentials } =
      response.credentials;

    log.info(
      'BackupCredentials: got ' +
        `${messageCredentials.length}/${mediaCredentials.length}`
    );

    const serverPublicParams = new GenericServerPublicParams(
      Buffer.from(window.getBackupServerPublicParams(), 'base64')
    );

    const result = new Array<BackupCredentialWrapperType>();

    const allCredentials = messageCredentials
      .map(credential => ({
        ...credential,
        ctx: messagesCtx,
        type: BackupCredentialType.Messages,
      }))
      .concat(
        mediaCredentials.map(credential => ({
          ...credential,
          ctx: mediaCtx,
          type: BackupCredentialType.Media,
        }))
      );

    const issuedTimes = new Set<`${BackupCredentialType}:${number}`>();
    for (const {
      type,
      ctx,
      credential: buf,
      redemptionTime,
    } of allCredentials) {
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
        !issuedTimes.has(`${type}:${redemptionTimeMs}`),
        'Invalid credential response redemption time, duplicate'
      );
      issuedTimes.add(`${type}:${redemptionTimeMs}`);

      const credential = ctx.receive(
        credentialRes,
        redemptionTime,
        serverPublicParams
      );

      result.push({
        type,
        credential: credential.serialize().toString('base64'),
        level: credential.getBackupLevel(),
        redemptionTimeMs,
      });
    }

    // Add cached credentials that are still in the date range, and not in
    // the response.
    for (const cached of this.#getFromCache()) {
      const { type, redemptionTimeMs } = cached;
      if (
        !(startDayInMs <= redemptionTimeMs && redemptionTimeMs <= endDayInMs)
      ) {
        continue;
      }

      if (issuedTimes.has(`${type}:${redemptionTimeMs}`)) {
        continue;
      }
      result.push(cached);
    }

    result.sort((a, b) => a.redemptionTimeMs - b.redemptionTimeMs);
    await this.#updateCache(result);

    const startMs = result[0].redemptionTimeMs;
    const endMs = result[result.length - 1].redemptionTimeMs;
    log.info(`BackupCredentials: saved [${startMs}, ${endMs}]`);

    strictAssert(result.length === 14, 'Expected one week of credentials');

    return result;
  }

  #getAuthContext(
    credentialType: BackupCredentialType
  ): BackupAuthCredentialRequestContext {
    let key: BackupKey;
    if (credentialType === BackupCredentialType.Messages) {
      key = getBackupKey();
    } else if (credentialType === BackupCredentialType.Media) {
      key = getBackupMediaRootKey();
    } else {
      throw missingCaseError(credentialType);
    }
    return BackupAuthCredentialRequestContext.create(
      key.serialize(),
      window.storage.user.getCheckedAci()
    );
  }

  #getFromCache(): ReadonlyArray<BackupCredentialWrapperType> {
    return window.storage.get('backupCombinedCredentials', []);
  }

  async #updateCache(
    values: ReadonlyArray<BackupCredentialWrapperType>
  ): Promise<void> {
    await window.storage.put('backupCombinedCredentials', values);
  }

  public async getBackupLevel(
    credentialType: BackupCredentialType
  ): Promise<BackupLevel> {
    return (await this.getForToday(credentialType)).level;
  }

  // Called when backup tier changes or when userChanged event
  public async clearCache(): Promise<void> {
    this.#cachedCdnReadCredentials = {};
    await this.#updateCache([]);
  }
}
