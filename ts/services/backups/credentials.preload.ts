// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type PrivateKey } from '@signalapp/libsignal-client';
import {
  BackupAuthCredential,
  BackupAuthCredentialRequestContext,
  BackupAuthCredentialResponse,
  type BackupLevel,
  GenericServerPublicParams,
} from '@signalapp/libsignal-client/zkgroup.js';
import { type BackupKey } from '@signalapp/libsignal-client/dist/AccountKeys.js';
import lodashFp from 'lodash/fp.js';

import * as Bytes from '../../Bytes.std.js';
import { createLogger } from '../../logging/log.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { drop } from '../../util/drop.std.js';
import { isMoreRecentThan, toDayMillis } from '../../util/timestamp.std.js';
import {
  DAY,
  DurationInSeconds,
  HOUR,
  MINUTE,
} from '../../util/durations/index.std.js';
import { BackOff, FIBONACCI_TIMEOUTS } from '../../util/BackOff.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import {
  type BackupCdnReadCredentialType,
  type BackupCredentialWrapperType,
  type BackupPresentationHeadersType,
  type BackupSignedPresentationType,
  BackupCredentialType,
} from '../../types/backups.node.js';
import { toLogFormat } from '../../types/errors.std.js';
import { HTTPError } from '../../types/HTTPError.std.js';
import type {
  GetBackupCredentialsResponseType,
  GetBackupCDNCredentialsResponseType,
} from '../../textsecure/WebAPI.preload.js';
import {
  setBackupSignatureKey,
  getBackupCDNCredentials,
  getBackupCredentials,
  setBackupId,
} from '../../textsecure/WebAPI.preload.js';
import {
  getBackupKey,
  getBackupMediaRootKey,
  getBackupSignatureKey,
  getBackupMediaSignatureKey,
} from './crypto.preload.js';
import { isTestOrMockEnvironment } from '../../environment.std.js';
import {
  areRemoteBackupsTurnedOn,
  canAttemptRemoteBackupDownload,
} from '../../util/isBackupEnabled.preload.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

const { throttle } = lodashFp;

const log = createLogger('Backup.Credentials');

const FETCH_INTERVAL = 3 * DAY;

//  Credentials should be good for 24 hours, but let's play it safe.
const BACKUP_CDN_READ_CREDENTIALS_VALID_DURATION = 12 * HOUR;

export class BackupCredentials {
  #activeFetch: Promise<ReadonlyArray<BackupCredentialWrapperType>> | undefined;

  #cachedCdnReadCredentials: Record<
    BackupCredentialType,
    Record<number, BackupCdnReadCredentialType>
  > = {
    [BackupCredentialType.Media]: {},
    [BackupCredentialType.Messages]: {},
  };

  readonly #fetchBackoff = new BackOff(FIBONACCI_TIMEOUTS);

  // Throttle credential clearing to avoid loops
  public readonly onCdnCredentialError = throttle(5 * MINUTE, () => {
    log.warn('onCdnCredentialError: clearing cache');
    this.#clearCdnReadCredentials();
  });

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
      log.info(`cache miss for ${now}`);
      credentials = await this.#fetch();
      result = credentials.find(({ type, redemptionTimeMs }) => {
        return type === credentialType && redemptionTimeMs === now;
      });
      strictAssert(
        result !== undefined,
        'Remote credentials do not include today'
      );
    }

    const cred = new BackupAuthCredential(Bytes.fromBase64(result.credential));

    const serverPublicParams = new GenericServerPublicParams(
      Bytes.fromBase64(window.getBackupServerPublicParams())
    );

    const presentation = cred.present(serverPublicParams).serialize();
    const signature = signatureKey.sign(presentation);

    const headers = {
      'X-Signal-ZK-Auth': Bytes.toBase64(presentation),
      'X-Signal-ZK-Auth-Signature': Bytes.toBase64(signature),
    };

    const info = { headers, level: result.level };
    if (itemStorage.get(storageKey)) {
      return info;
    }

    log.warn(`uploading signature key (${storageKey})`);

    await setBackupSignatureKey({
      headers,
      backupIdPublicKey: signatureKey.getPublicKey().serialize(),
    });

    await itemStorage.put(storageKey, true);

    return info;
  }

  public async getHeadersForToday(
    credentialType: BackupCredentialType
  ): Promise<BackupPresentationHeadersType> {
    const { headers } = await this.getForToday(credentialType);
    return headers;
  }

  public async getCDNReadCredentials(
    cdnNumber: number,
    credentialType: BackupCredentialType
  ): Promise<GetBackupCDNCredentialsResponseType> {
    // Backup CDN read credentials are short-lived; we'll just cache them in memory so
    // that they get invalidated for any reason, we'll fetch new ones on app restart
    const cachedCredentialsForThisCredentialType =
      this.#cachedCdnReadCredentials[credentialType];

    const cachedCredentials = cachedCredentialsForThisCredentialType[cdnNumber];

    if (
      cachedCredentials &&
      isMoreRecentThan(
        cachedCredentials.retrievedAtMs,
        BACKUP_CDN_READ_CREDENTIALS_VALID_DURATION
      )
    ) {
      return cachedCredentials.credentials;
    }

    const headers = await this.getHeadersForToday(credentialType);

    const retrievedAtMs = Date.now();
    const newCredentials = await getBackupCDNCredentials({
      headers,
      cdnNumber,
    });

    cachedCredentialsForThisCredentialType[cdnNumber] = {
      credentials: newCredentials,
      cdnNumber,
      retrievedAtMs,
    };

    return newCredentials;
  }

  #scheduleFetch(): void {
    const lastFetchAt = itemStorage.get(
      'backupCombinedCredentialsLastRequestTime',
      0
    );
    const nextFetchAt = lastFetchAt + FETCH_INTERVAL;
    const delay = Math.max(0, nextFetchAt - Date.now());

    log.info(`scheduling fetch in ${delay}ms`);
    setTimeout(() => drop(this.#runPeriodicFetch()), delay);
  }

  async #runPeriodicFetch(): Promise<void> {
    try {
      log.info('running periodic fetch');
      await this.#fetch();

      const now = Date.now();
      await itemStorage.put('backupCombinedCredentialsLastRequestTime', now);

      this.#fetchBackoff.reset();
      this.#scheduleFetch();
    } catch (error) {
      const delay = this.#fetchBackoff.getAndIncrement();
      log.error(
        'periodic fetch failed with ' +
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
    const canInteractWithBackupService =
      areRemoteBackupsTurnedOn() || canAttemptRemoteBackupDownload();

    if (!canInteractWithBackupService) {
      throw new Error(
        'Cannot fetch credentials; remote backups are not active'
      );
    }

    log.info('fetching');

    const now = Date.now();
    const startDayInMs = toDayMillis(now);
    const endDayInMs = toDayMillis(now + 6 * DAY);

    // And fetch missing credentials
    const messagesCtx = this.#getAuthContext(BackupCredentialType.Messages);
    const mediaCtx = this.#getAuthContext(BackupCredentialType.Media);

    let response: GetBackupCredentialsResponseType;
    try {
      response = await getBackupCredentials({
        startDayInMs,
        endDayInMs,
      });
    } catch (error) {
      // A 404 indicates the backupId has not been set; only primary devices can set the
      // backupId
      if (
        (isTestOrMockEnvironment() ||
          window.ConversationController.areWePrimaryDevice()) &&
        error instanceof HTTPError &&
        error.code === 404
      ) {
        // Backup id is missing
        const messagesRequest = messagesCtx.getRequest();
        const mediaRequest = mediaCtx.getRequest();

        // Set it
        await setBackupId({
          messagesBackupAuthCredentialRequest: messagesRequest.serialize(),
          mediaBackupAuthCredentialRequest: mediaRequest.serialize(),
        });

        // And try again!
        response = await getBackupCredentials({
          startDayInMs,
          endDayInMs,
        });
      } else {
        throw error;
      }
    }

    const { messages: messageCredentials, media: mediaCredentials } =
      response.credentials;

    log.info(
      `got ${messageCredentials.length}/${mediaCredentials.length} message/media credentials`
    );

    const serverPublicParams = new GenericServerPublicParams(
      Bytes.fromBase64(window.getBackupServerPublicParams())
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
      const credentialRes = new BackupAuthCredentialResponse(buf);

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
        credential: Bytes.toBase64(credential.serialize()),
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
    log.info(`saved [${startMs}, ${endMs}]`);

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
      itemStorage.user.getCheckedAci()
    );
  }

  #getFromCache(): ReadonlyArray<BackupCredentialWrapperType> {
    return itemStorage.get('backupCombinedCredentials', []);
  }

  async #updateCache(
    values: ReadonlyArray<BackupCredentialWrapperType>
  ): Promise<void> {
    await itemStorage.put('backupCombinedCredentials', values);
  }

  public async getBackupLevel(
    credentialType: BackupCredentialType
  ): Promise<BackupLevel> {
    return (await this.getForToday(credentialType)).level;
  }

  // Called when backup tier changes or when userChanged event
  public async clearCache(): Promise<void> {
    log.info('Clearing cache');
    this.#clearCdnReadCredentials();
    await this.#updateCache([]);
  }

  #clearCdnReadCredentials(): void {
    this.#cachedCdnReadCredentials = {
      [BackupCredentialType.Media]: {},
      [BackupCredentialType.Messages]: {},
    };
  }
}
