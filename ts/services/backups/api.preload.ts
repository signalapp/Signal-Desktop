// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type Readable } from 'node:stream';

import {
  backupListMedia,
  getBackupFileHeaders,
  getBackupMediaUploadForm,
  getBackupStream,
  getBackupUploadForm,
  getEphemeralBackupStream,
  getMediaBackupInfo,
  getMessageBackupInfo,
  getSubscription,
  getTransferArchive as doGetTransferArchive,
  refreshBackup,
} from '../../textsecure/WebAPI.preload.ts';
import type {
  AttachmentUploadFormType,
  GetMediaBackupInfoResponseType,
  GetMessageBackupInfoResponseType,
  BackupListMediaResponseType,
  TransferArchiveType,
  SubscriptionResponseType,
} from '../../textsecure/WebAPI.preload.ts';
import type { BackupCredentials } from './credentials.preload.ts';
import {
  BackupCredentialType,
  type BackupsSubscriptionType,
  type SubscriptionCostType,
} from '../../types/backups.node.ts';
import { uploadFile } from '../../util/uploadAttachment.preload.ts';
import { HTTPError } from '../../types/HTTPError.std.ts';
import { createLogger } from '../../logging/log.std.ts';
import { toLogFormat } from '../../types/errors.std.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';

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
  readonly #credentials: BackupCredentials;
  #cachedMessageBackupInfo: GetMessageBackupInfoResponseType | undefined;
  #cachedMediaBackupInfo: GetMediaBackupInfoResponseType | undefined;

  constructor(credentials: BackupCredentials) {
    this.#credentials = credentials;
  }

  public async refresh(): Promise<void> {
    await Promise.all(
      [BackupCredentialType.Messages, BackupCredentialType.Media].map(type =>
        this.#refreshType(type)
      )
    );
  }

  async #refreshType(type: BackupCredentialType): Promise<void> {
    const auth = await this.#credentials.getForToday(type);
    return refreshBackup({ auth });
  }

  public async getMessageBackupInfo(): Promise<GetMessageBackupInfoResponseType> {
    const backupAuth = await this.#credentials.getForToday(
      BackupCredentialType.Messages
    );
    const backupInfo = await getMessageBackupInfo({ auth: backupAuth });
    this.#cachedMessageBackupInfo = backupInfo;
    return backupInfo;
  }

  public async getMediaBackupInfo(): Promise<GetMediaBackupInfoResponseType> {
    const backupAuth = await this.#credentials.getForToday(
      BackupCredentialType.Media
    );
    const backupInfo = await getMediaBackupInfo({ auth: backupAuth });
    this.#cachedMediaBackupInfo = backupInfo;
    return backupInfo;
  }

  async #getCachedMessageBackupInfo(): Promise<GetMessageBackupInfoResponseType> {
    return this.#cachedMessageBackupInfo ?? this.getMessageBackupInfo();
  }

  async #getCachedMediaBackupInfo(): Promise<GetMediaBackupInfoResponseType> {
    return this.#cachedMediaBackupInfo ?? this.getMediaBackupInfo();
  }

  public async getMediaDir(): Promise<string> {
    return (await this.#getCachedMediaBackupInfo()).mediaDir;
  }

  public async getBackupDir(): Promise<string> {
    return (await this.#getCachedMediaBackupInfo()).backupDir;
  }

  public async upload(filePath: string, fileSize: number): Promise<void> {
    const backupAuth = await this.#credentials.getForToday(
      BackupCredentialType.Messages
    );

    const form = await getBackupUploadForm({
      auth: backupAuth,
      uploadSize: fileSize,
    });

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
    const { cdn, backupDir, backupName } = await this.getMessageBackupInfo();
    const { headers } = await this.#credentials.getCDNReadCredentials(
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
    const { cdn, backupDir, backupName } =
      await this.#getCachedMessageBackupInfo();
    const { headers } = await this.#credentials.getCDNReadCredentials(
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
        this.#credentials.onCdnCredentialError();
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

  public async getMediaUploadForm(
    uploadSize: number
  ): Promise<AttachmentUploadFormType> {
    const backupAuth = await this.#credentials.getForToday(
      BackupCredentialType.Media
    );

    return getBackupMediaUploadForm({ auth: backupAuth, uploadSize });
  }

  public async listMedia({
    cursor,
    limit,
  }: {
    cursor?: string;
    limit: number;
  }): Promise<BackupListMediaResponseType> {
    const backupAuth = await this.#credentials.getForToday(
      BackupCredentialType.Media
    );

    return backupListMedia({ auth: backupAuth, cursor, limit });
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
    this.#cachedMessageBackupInfo = undefined;
    this.#cachedMediaBackupInfo = undefined;
  }
}
