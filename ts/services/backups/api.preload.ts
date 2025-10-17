// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type Readable } from 'node:stream';

import {
  backupListMedia,
  backupMediaBatch as doBackupMediaBatch,
  getBackupFileHeaders,
  getBackupInfo,
  getBackupMediaUploadForm,
  getBackupStream,
  getBackupUploadForm,
  getEphemeralBackupStream,
  getSubscription,
  getTransferArchive as doGetTransferArchive,
  refreshBackup,
} from '../../textsecure/WebAPI.preload.js';
import type {
  AttachmentUploadFormResponseType,
  GetBackupInfoResponseType,
  BackupMediaItemType,
  BackupMediaBatchResponseType,
  BackupListMediaResponseType,
  TransferArchiveType,
  SubscriptionResponseType,
} from '../../textsecure/WebAPI.preload.js';
import type { BackupCredentials } from './credentials.preload.js';
import {
  BackupCredentialType,
  type BackupsSubscriptionType,
  type SubscriptionCostType,
} from '../../types/backups.node.js';
import { uploadFile } from '../../util/uploadAttachment.preload.js';
import { HTTPError } from '../../types/HTTPError.std.js';
import { createLogger } from '../../logging/log.std.js';
import { toLogFormat } from '../../types/errors.std.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

const log = createLogger('api');

export type DownloadOptionsType = Readonly<{
  downloadOffset: number;
  onProgress: (currentBytes: number, totalBytes: number) => void;
  abortSignal?: AbortSignal;
}>;

export type EphemeralDownloadOptionsType = Readonly<{
  archive: Readonly<{
    cdn: number;
    key: string;
  }>;
}> &
  DownloadOptionsType;

export class BackupAPI {
  #cachedBackupInfo = new Map<
    BackupCredentialType,
    GetBackupInfoResponseType
  >();

  constructor(private readonly credentials: BackupCredentials) {}

  public async refresh(): Promise<void> {
    const headers = await Promise.all(
      [BackupCredentialType.Messages, BackupCredentialType.Media].map(type =>
        this.credentials.getHeadersForToday(type)
      )
    );
    await Promise.all(headers.map(h => refreshBackup(h)));
  }

  public async getInfo(
    credentialType: BackupCredentialType
  ): Promise<GetBackupInfoResponseType> {
    const backupInfo = await getBackupInfo(
      await this.credentials.getHeadersForToday(credentialType)
    );
    this.#cachedBackupInfo.set(credentialType, backupInfo);
    return backupInfo;
  }

  async #getCachedInfo(
    credentialType: BackupCredentialType
  ): Promise<GetBackupInfoResponseType> {
    const cached = this.#cachedBackupInfo.get(credentialType);
    if (cached) {
      return cached;
    }

    return this.getInfo(credentialType);
  }

  public async getMediaDir(): Promise<string> {
    return (await this.#getCachedInfo(BackupCredentialType.Media)).mediaDir;
  }

  public async getBackupDir(): Promise<string> {
    return (await this.#getCachedInfo(BackupCredentialType.Media))?.backupDir;
  }

  public async upload(filePath: string, fileSize: number): Promise<void> {
    const form = await getBackupUploadForm(
      await this.credentials.getHeadersForToday(BackupCredentialType.Messages)
    );

    await uploadFile({
      absoluteCiphertextPath: filePath,
      ciphertextFileSize: fileSize,
      uploadForm: form,
    });
  }

  public async download({
    downloadOffset,
    onProgress,
    abortSignal,
  }: DownloadOptionsType): Promise<Readable> {
    const { cdn, backupDir, backupName } = await this.getInfo(
      BackupCredentialType.Messages
    );
    const { headers } = await this.credentials.getCDNReadCredentials(
      cdn,
      BackupCredentialType.Messages
    );

    return getBackupStream({
      cdn,
      backupDir,
      backupName,
      headers,
      downloadOffset,
      onProgress,
      abortSignal,
    });
  }

  public async getBackupProtoInfo(): Promise<
    | { backupExists: false }
    | { backupExists: true; size: number; createdAt: Date }
  > {
    const { cdn, backupDir, backupName } = await this.#getCachedInfo(
      BackupCredentialType.Messages
    );
    const { headers } = await this.credentials.getCDNReadCredentials(
      cdn,
      BackupCredentialType.Messages
    );
    try {
      const { 'content-length': size, 'last-modified': createdAt } =
        await getBackupFileHeaders({
          cdn,
          backupDir,
          backupName,
          headers,
        });
      return { backupExists: true, size, createdAt };
    } catch (error) {
      if (error instanceof HTTPError && error.code === 401) {
        this.credentials.onCdnCredentialError();
      } else if (error instanceof HTTPError && error.code === 404) {
        return { backupExists: false };
      }
      throw error;
    }
  }

  public async getTransferArchive(
    abortSignal: AbortSignal
  ): Promise<TransferArchiveType> {
    return doGetTransferArchive({
      abortSignal,
    });
  }

  public async downloadEphemeral({
    archive,
    downloadOffset,
    onProgress,
    abortSignal,
  }: EphemeralDownloadOptionsType): Promise<Readable> {
    return getEphemeralBackupStream({
      cdn: archive.cdn,
      key: archive.key,
      downloadOffset,
      onProgress,
      abortSignal,
    });
  }

  public async getMediaUploadForm(): Promise<AttachmentUploadFormResponseType> {
    return getBackupMediaUploadForm(
      await this.credentials.getHeadersForToday(BackupCredentialType.Media)
    );
  }

  public async backupMediaBatch(
    items: ReadonlyArray<BackupMediaItemType>
  ): Promise<BackupMediaBatchResponseType> {
    return doBackupMediaBatch({
      headers: await this.credentials.getHeadersForToday(
        BackupCredentialType.Media
      ),
      items,
    });
  }

  public async listMedia({
    cursor,
    limit,
  }: {
    cursor?: string;
    limit: number;
  }): Promise<BackupListMediaResponseType> {
    return backupListMedia({
      headers: await this.credentials.getHeadersForToday(
        BackupCredentialType.Media
      ),
      cursor,
      limit,
    });
  }

  public async getSubscriptionInfo(): Promise<BackupsSubscriptionType> {
    const subscriberId = itemStorage.get('backupsSubscriberId');
    if (!subscriberId) {
      log.warn('Backups.getSubscriptionInfo: missing subscriberId');
      return { status: 'not-found' };
    }

    let subscriptionResponse: SubscriptionResponseType;
    try {
      subscriptionResponse = await getSubscription(subscriberId);
    } catch (e) {
      log.warn(
        'Backups.getSubscriptionInfo: error fetching subscription',
        toLogFormat(e)
      );
      return { status: 'not-found' };
    }

    const { subscription } = subscriptionResponse;
    if (!subscription) {
      return { status: 'not-found' };
    }

    const { active, amount, currency, endOfCurrentPeriod, cancelAtPeriodEnd } =
      subscription;

    if (!active) {
      return { status: 'expired' };
    }

    let cost: SubscriptionCostType | undefined;
    if (amount && currency) {
      cost = {
        amount,
        currencyCode: currency,
      };
    } else {
      log.error(
        'Backups.getSubscriptionInfo: invalid amount/currency returned for active subscription'
      );
    }

    if (cancelAtPeriodEnd) {
      return {
        status: 'pending-cancellation',
        cost,
        expiryTimestamp: endOfCurrentPeriod?.getTime(),
      };
    }

    return {
      status: 'active',
      cost,
      renewalTimestamp: endOfCurrentPeriod?.getTime(),
    };
  }

  public clearCache(): void {
    this.#cachedBackupInfo.clear();
  }
}
