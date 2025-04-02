// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type Readable } from 'node:stream';

import { strictAssert } from '../../util/assert';
import type {
  WebAPIType,
  AttachmentUploadFormResponseType,
  GetBackupInfoResponseType,
  BackupMediaItemType,
  BackupMediaBatchResponseType,
  BackupListMediaResponseType,
  TransferArchiveType,
  SubscriptionResponseType,
} from '../../textsecure/WebAPI';
import type { BackupCredentials } from './credentials';
import {
  BackupCredentialType,
  type BackupsSubscriptionType,
  type SubscriptionCostType,
} from '../../types/backups';
import { uploadFile } from '../../util/uploadAttachment';
import { HTTPError } from '../../textsecure/Errors';
import * as log from '../../logging/log';
import { toLogFormat } from '../../types/errors';

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
    await Promise.all(headers.map(h => this.#server.refreshBackup(h)));
  }

  public async getInfo(
    credentialType: BackupCredentialType
  ): Promise<GetBackupInfoResponseType> {
    const backupInfo = await this.#server.getBackupInfo(
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
    const form = await this.#server.getBackupUploadForm(
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

    return this.#server.getBackupStream({
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
        await this.#server.getBackupFileHeaders({
          cdn,
          backupDir,
          backupName,
          headers,
        });
      return { backupExists: true, size, createdAt };
    } catch (error) {
      if (error instanceof HTTPError && error.code === 404) {
        return { backupExists: false };
      }
      throw error;
    }
  }

  public async getTransferArchive(
    abortSignal: AbortSignal
  ): Promise<TransferArchiveType> {
    return this.#server.getTransferArchive({
      abortSignal,
    });
  }

  public async downloadEphemeral({
    archive,
    downloadOffset,
    onProgress,
    abortSignal,
  }: EphemeralDownloadOptionsType): Promise<Readable> {
    return this.#server.getEphemeralBackupStream({
      cdn: archive.cdn,
      key: archive.key,
      downloadOffset,
      onProgress,
      abortSignal,
    });
  }

  public async getMediaUploadForm(): Promise<AttachmentUploadFormResponseType> {
    return this.#server.getBackupMediaUploadForm(
      await this.credentials.getHeadersForToday(BackupCredentialType.Media)
    );
  }

  public async backupMediaBatch(
    items: ReadonlyArray<BackupMediaItemType>
  ): Promise<BackupMediaBatchResponseType> {
    return this.#server.backupMediaBatch({
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
    return this.#server.backupListMedia({
      headers: await this.credentials.getHeadersForToday(
        BackupCredentialType.Media
      ),
      cursor,
      limit,
    });
  }

  public async getSubscriptionInfo(): Promise<BackupsSubscriptionType> {
    const subscriberId = window.storage.get('backupsSubscriberId');
    if (!subscriberId) {
      log.error('Backups.getSubscriptionInfo: missing subscriberId');
      return { status: 'not-found' };
    }

    let subscriptionResponse: SubscriptionResponseType;
    try {
      subscriptionResponse = await this.#server.getSubscription(subscriberId);
    } catch (e) {
      log.error(
        'Backups.getSubscriptionInfo: error fetching subscription',
        toLogFormat(e)
      );
      return { status: 'not-found' };
    }

    const { subscription } = subscriptionResponse;
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
        expiryDate: endOfCurrentPeriod,
      };
    }

    return {
      status: 'active',
      cost,
      renewalDate: endOfCurrentPeriod,
    };
  }

  public clearCache(): void {
    this.#cachedBackupInfo.clear();
  }

  get #server(): WebAPIType {
    const { server } = window.textsecure;
    strictAssert(server, 'server not available');

    return server;
  }
}
