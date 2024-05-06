// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Readable } from 'stream';

import { strictAssert } from '../../util/assert';
import type {
  WebAPIType,
  GetBackupInfoResponseType,
  GetBackupUploadFormResponseType,
  BackupMediaItemType,
  BackupMediaBatchResponseType,
  BackupListMediaResponseType,
} from '../../textsecure/WebAPI';
import type { BackupCredentials } from './credentials';

export class BackupAPI {
  constructor(private credentials: BackupCredentials) {}

  public async refresh(): Promise<void> {
    // TODO: DESKTOP-6979
    await this.server.refreshBackup(
      await this.credentials.getHeadersForToday()
    );
  }

  public async getInfo(): Promise<GetBackupInfoResponseType> {
    return this.server.getBackupInfo(
      await this.credentials.getHeadersForToday()
    );
  }

  public async upload(stream: Readable): Promise<string> {
    return this.server.uploadBackup({
      headers: await this.credentials.getHeadersForToday(),
      stream,
    });
  }

  public async getMediaUploadForm(): Promise<GetBackupUploadFormResponseType> {
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

  private get server(): WebAPIType {
    const { server } = window.textsecure;
    strictAssert(server, 'server not available');

    return server;
  }
}
