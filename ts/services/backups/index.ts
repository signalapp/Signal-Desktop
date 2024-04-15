// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { pipeline } from 'stream/promises';
import { PassThrough } from 'stream';
import type { Readable, Writable } from 'stream';
import { createWriteStream } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { createCipheriv, createHmac, randomBytes } from 'crypto';
import { noop } from 'lodash';

import * as log from '../../logging/log';
import * as Bytes from '../../Bytes';
import { DelimitedStream } from '../../util/DelimitedStream';
import { appendPaddingStream } from '../../util/logPadding';
import { prependStream } from '../../util/prependStream';
import { appendMacStream } from '../../util/appendMacStream';
import { toAciObject } from '../../util/ServiceId';
import { CipherType, HashType } from '../../types/Crypto';
import * as Errors from '../../types/errors';
import {
  deriveBackupKey,
  deriveBackupId,
  deriveBackupKeyMaterial,
  constantTimeEqual,
} from '../../Crypto';
import type { BackupKeyMaterialType } from '../../Crypto';
import { getIvAndDecipher, getMacAndUpdateHmac } from '../../AttachmentCrypto';
import { BackupExportStream } from './export';
import { BackupImportStream } from './import';

const IV_LENGTH = 16;

function getKeyMaterial(): BackupKeyMaterialType {
  const masterKey = window.storage.get('masterKey');
  if (!masterKey) {
    throw new Error('Master key not available');
  }

  const aci = toAciObject(window.storage.user.getCheckedAci());
  const aciBytes = aci.getServiceIdBinary();

  const backupKey = deriveBackupKey(Bytes.fromBase64(masterKey));
  const backupId = deriveBackupId(backupKey, aciBytes);
  return deriveBackupKeyMaterial(backupKey, backupId);
}

export class BackupsService {
  private isRunning = false;

  public async exportBackup(sink: Writable): Promise<void> {
    if (this.isRunning) {
      throw new Error('BackupService is already running');
    }

    log.info('exportBackup: starting...');
    this.isRunning = true;

    try {
      const { aesKey, macKey } = getKeyMaterial();

      const recordStream = new BackupExportStream();
      recordStream.run();

      const iv = randomBytes(IV_LENGTH);

      await pipeline(
        recordStream,
        createGzip(),
        appendPaddingStream(),
        createCipheriv(CipherType.AES256CBC, aesKey, iv),
        prependStream(iv),
        appendMacStream(macKey),
        sink
      );
    } finally {
      log.info('exportBackup: finished...');
      this.isRunning = false;
    }
  }

  // Test harness
  public async exportBackupData(): Promise<Uint8Array> {
    const sink = new PassThrough();

    const chunks = new Array<Uint8Array>();
    sink.on('data', chunk => chunks.push(chunk));
    await this.exportBackup(sink);

    return Bytes.concatenate(chunks);
  }

  // Test harness
  public async exportToDisk(path: string): Promise<void> {
    await this.exportBackup(createWriteStream(path));
  }

  // Test harness
  public async exportWithDialog(): Promise<void> {
    const data = await this.exportBackupData();

    const { saveAttachmentToDisk } = window.Signal.Migrations;

    await saveAttachmentToDisk({
      name: 'backup.bin',
      data,
    });
  }

  public async importBackup(createBackupStream: () => Readable): Promise<void> {
    if (this.isRunning) {
      throw new Error('BackupService is already running');
    }

    log.info('importBackup: starting...');
    this.isRunning = true;

    try {
      const { aesKey, macKey } = getKeyMaterial();

      // First pass - don't decrypt, only verify mac
      let hmac = createHmac(HashType.size256, macKey);
      let theirMac: Uint8Array | undefined;

      const sink = new PassThrough();
      // Discard the data in the first pass
      sink.resume();

      await pipeline(
        createBackupStream(),
        getMacAndUpdateHmac(hmac, theirMacValue => {
          theirMac = theirMacValue;
        }),
        sink
      );

      if (theirMac == null) {
        throw new Error('importBackup: Missing MAC');
      }

      if (!constantTimeEqual(hmac.digest(), theirMac)) {
        throw new Error('importBackup: Bad MAC');
      }

      // Second pass - decrypt (but still check the mac at the end)
      hmac = createHmac(HashType.size256, macKey);

      await pipeline(
        createBackupStream(),
        getMacAndUpdateHmac(hmac, noop),
        getIvAndDecipher(aesKey),
        createGunzip(),
        new DelimitedStream(),
        new BackupImportStream()
      );

      if (!constantTimeEqual(hmac.digest(), theirMac)) {
        throw new Error('importBackup: Bad MAC, second pass');
      }

      log.info('importBackup: finished...');
    } catch (error) {
      log.info(`importBackup: failed, error: ${Errors.toLogFormat(error)}`);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
}

export const backupsService = new BackupsService();
