// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from 'chai';
import Long from 'long';
import { Backups } from '../../protobuf';
import { convertFilePointerToAttachment } from '../../services/backups/util/filePointers';
import { APPLICATION_OCTET_STREAM, IMAGE_PNG } from '../../types/MIME';
import * as Bytes from '../../Bytes';

describe('convertFilePointerToAttachment', () => {
  it('processes filepointer with attachmentLocator', () => {
    const result = convertFilePointerToAttachment(
      new Backups.FilePointer({
        contentType: 'image/png',
        width: 100,
        height: 100,
        blurHash: 'blurhash',
        fileName: 'filename',
        caption: 'caption',
        incrementalMac: Bytes.fromString('incrementalMac'),
        incrementalMacChunkSize: 1000,
        attachmentLocator: new Backups.FilePointer.AttachmentLocator({
          size: 128,
          cdnKey: 'cdnKey',
          cdnNumber: 2,
          key: Bytes.fromString('key'),
          digest: Bytes.fromString('digest'),
          uploadTimestamp: Long.fromNumber(1970),
        }),
      })
    );

    assert.deepStrictEqual(result, {
      contentType: IMAGE_PNG,
      width: 100,
      height: 100,
      size: 128,
      blurHash: 'blurhash',
      fileName: 'filename',
      caption: 'caption',
      cdnKey: 'cdnKey',
      cdnNumber: 2,
      key: Bytes.toBase64(Bytes.fromString('key')),
      digest: Bytes.toBase64(Bytes.fromString('digest')),
      uploadTimestamp: 1970,
      incrementalMac: Bytes.toBase64(Bytes.fromString('incrementalMac')),
      incrementalMacChunkSize: 1000,
    });
  });

  it('processes filepointer with backupLocator and missing fields', () => {
    const result = convertFilePointerToAttachment(
      new Backups.FilePointer({
        contentType: 'image/png',
        width: 100,
        height: 100,
        blurHash: 'blurhash',
        fileName: 'filename',
        caption: 'caption',
        incrementalMac: Bytes.fromString('incrementalMac'),
        incrementalMacChunkSize: 1000,
        backupLocator: new Backups.FilePointer.BackupLocator({
          mediaName: 'mediaName',
          cdnNumber: 3,
          size: 128,
          key: Bytes.fromString('key'),
          digest: Bytes.fromString('digest'),
          transitCdnKey: 'transitCdnKey',
          transitCdnNumber: 2,
        }),
      })
    );

    assert.deepStrictEqual(result, {
      contentType: IMAGE_PNG,
      width: 100,
      height: 100,
      size: 128,
      blurHash: 'blurhash',
      fileName: 'filename',
      caption: 'caption',
      cdnKey: 'transitCdnKey',
      cdnNumber: 2,
      key: Bytes.toBase64(Bytes.fromString('key')),
      digest: Bytes.toBase64(Bytes.fromString('digest')),
      incrementalMac: Bytes.toBase64(Bytes.fromString('incrementalMac')),
      incrementalMacChunkSize: 1000,
      backupLocator: {
        mediaName: 'mediaName',
        cdnNumber: 3,
      },
    });
  });

  it('processes filepointer with invalidAttachmentLocator', () => {
    const result = convertFilePointerToAttachment(
      new Backups.FilePointer({
        contentType: 'image/png',
        width: 100,
        height: 100,
        blurHash: 'blurhash',
        fileName: 'filename',
        caption: 'caption',
        incrementalMac: Bytes.fromString('incrementalMac'),
        incrementalMacChunkSize: 1000,
        invalidAttachmentLocator:
          new Backups.FilePointer.InvalidAttachmentLocator(),
      })
    );

    assert.deepStrictEqual(result, {
      contentType: IMAGE_PNG,
      width: 100,
      height: 100,
      blurHash: 'blurhash',
      fileName: 'filename',
      caption: 'caption',
      incrementalMac: Bytes.toBase64(Bytes.fromString('incrementalMac')),
      incrementalMacChunkSize: 1000,
      size: 0,
      error: true,
    });
  });

  it('accepts missing / null fields and adds defaults to contentType and size', () => {
    const result = convertFilePointerToAttachment(
      new Backups.FilePointer({
        backupLocator: new Backups.FilePointer.BackupLocator(),
      })
    );

    assert.deepStrictEqual(result, {
      contentType: APPLICATION_OCTET_STREAM,
      size: 0,
      width: undefined,
      height: undefined,
      blurHash: undefined,
      fileName: undefined,
      caption: undefined,
      cdnKey: undefined,
      cdnNumber: undefined,
      key: undefined,
      digest: undefined,
      incrementalMac: undefined,
      incrementalMacChunkSize: undefined,
      backupLocator: undefined,
    });
  });
});
