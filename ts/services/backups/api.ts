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
} from '../../textsecure/WebAPI';
import type { BackupCredentials } from './credentials';
import { BackupCredentialType } from '../../types/backups';
import { uploadFile } from '../../util/uploadAttachment';

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

  public clearCache(): void {
    this.#cachedBackupInfo.clear();
  }

  get #server(): WebAPIType {
    const { server } = window.textsecure;
    strictAssert(server, 'server not available');

    return server;
  }
}
