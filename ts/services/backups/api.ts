// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { strictAssert } from '../../util/assert';
import type {
  WebAPIType,
  AttachmentV3ResponseType,
  GetBackupInfoResponseType,
  BackupMediaItemType,
  BackupMediaBatchResponseType,
  BackupListMediaResponseType,
} from '../../textsecure/WebAPI';
import type { BackupCredentials } from './credentials';
import { uploadFile } from '../../util/uploadAttachment';

export class BackupAPI {
  private cachedBackupInfo: GetBackupInfoResponseType | undefined;
  constructor(private credentials: BackupCredentials) {}

  public async refresh(): Promise<void> {
    // TODO: DESKTOP-6979
    await this.server.refreshBackup(
      await this.credentials.getHeadersForToday()
    );
  }

  public async getInfo(): Promise<GetBackupInfoResponseType> {
    const backupInfo = await this.server.getBackupInfo(
      await this.credentials.getHeadersForToday()
    );
    this.cachedBackupInfo = backupInfo;
    return backupInfo;
  }

  private async getCachedInfo(): Promise<GetBackupInfoResponseType> {
    if (this.cachedBackupInfo) {
      return this.cachedBackupInfo;
    }

    return this.getInfo();
  }

  public async getMediaDir(): Promise<string> {
    return (await this.getCachedInfo()).mediaDir;
  }

  public async getBackupDir(): Promise<string> {
    return (await this.getCachedInfo())?.backupDir;
  }

  // Backup name will change whenever a new backup is created, so we don't want to cache
  // it
  public async getBackupName(): Promise<string> {
    return (await this.getInfo()).backupName;
  }

  public async upload(filePath: string, fileSize: number): Promise<void> {
    const form = await this.server.getBackupUploadForm(
      await this.credentials.getHeadersForToday()
    );

    await uploadFile({
      absoluteCiphertextPath: filePath,
      ciphertextFileSize: fileSize,
      uploadForm: form,
    });
  }

  public async getMediaUploadForm(): Promise<AttachmentV3ResponseType> {
    return this.server.getBackupMediaUploadForm(
      await this.credentials.getHeadersForToday()
    );
  }

  public async backupMediaBatch(
    items: ReadonlyArray<BackupMediaItemType>
  ): Promise<BackupMediaBatchResponseType> {
    return this.server.backupMediaBatch({
      headers: await this.credentials.getHeadersForToday(),
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
    return this.server.backupListMedia({
      headers: await this.credentials.getHeadersForToday(),
      cursor,
      limit,
    });
  }

  public clearCache(): void {
    this.cachedBackupInfo = undefined;
  }

  private get server(): WebAPIType {
    const { server } = window.textsecure;
    strictAssert(server, 'server not available');

    return server;
  }
}
