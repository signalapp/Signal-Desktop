// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from 'chai';
import Long from 'long';
import { join } from 'path';
import * as sinon from 'sinon';
import { BackupLevel } from '@signalapp/libsignal-client/zkgroup';
import { Backups } from '../../protobuf';
import {
  convertAttachmentToFilePointer,
  convertFilePointerToAttachment,
} from '../../services/backups/util/filePointers';
import { APPLICATION_OCTET_STREAM, IMAGE_PNG } from '../../types/MIME';
import * as Bytes from '../../Bytes';
import type { AttachmentType } from '../../types/Attachment';
import { strictAssert } from '../../util/assert';

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

function composeAttachment(
  overrides: Partial<AttachmentType> = {}
): AttachmentType {
  return {
    size: 100,
    contentType: IMAGE_PNG,
    cdnKey: 'cdnKey',
    cdnNumber: 2,
    path: 'path/to/file.png',
    key: 'key',
    digest: 'digest',
    width: 100,
    height: 100,
    blurHash: 'blurhash',
    fileName: 'filename',
    caption: 'caption',
    incrementalMac: 'incrementalMac',
    incrementalMacChunkSize: 1000,
    uploadTimestamp: 1234,
    ...overrides,
  };
}

const defaultFilePointer = new Backups.FilePointer({
  contentType: IMAGE_PNG,
  width: 100,
  height: 100,
  blurHash: 'blurhash',
  fileName: 'filename',
  caption: 'caption',
  incrementalMac: Bytes.fromBase64('incrementalMac'),
  incrementalMacChunkSize: 1000,
});

const defaultAttachmentLocator = new Backups.FilePointer.AttachmentLocator({
  cdnKey: 'cdnKey',
  cdnNumber: 2,
  key: Bytes.fromBase64('key'),
  digest: Bytes.fromBase64('digest'),
  size: 100,
  uploadTimestamp: Long.fromNumber(1234),
});

const defaultMediaName = 'digest';
const defaultBackupLocator = new Backups.FilePointer.BackupLocator({
  mediaName: defaultMediaName,
  cdnNumber: null,
  key: Bytes.fromBase64('key'),
  digest: Bytes.fromBase64('digest'),
  size: 100,
  transitCdnKey: 'cdnKey',
  transitCdnNumber: 2,
});

const filePointerWithAttachmentLocator = new Backups.FilePointer({
  ...defaultFilePointer,
  attachmentLocator: defaultAttachmentLocator,
});

const filePointerWithBackupLocator = new Backups.FilePointer({
  ...defaultFilePointer,
  backupLocator: defaultBackupLocator,
});
const filePointerWithInvalidLocator = new Backups.FilePointer({
  ...defaultFilePointer,
  invalidAttachmentLocator: new Backups.FilePointer.InvalidAttachmentLocator(),
});

async function testAttachmentToFilePointer(
  attachment: AttachmentType,
  filePointer: Backups.FilePointer,
  options?: { backupLevel?: BackupLevel; backupCdnNumber?: number }
) {
  async function _doTest(withBackupLevel: BackupLevel) {
    assert.deepStrictEqual(
      await convertAttachmentToFilePointer({
        attachment,
        backupLevel: withBackupLevel,
        getBackupTierInfo: _mediaName => {
          if (options?.backupCdnNumber != null) {
            return { isInBackupTier: true, cdnNumber: options.backupCdnNumber };
          }
          return { isInBackupTier: false };
        },
      }),
      filePointer
    );
  }

  if (!options?.backupLevel) {
    await _doTest(BackupLevel.Messages);
    await _doTest(BackupLevel.Media);
  } else {
    await _doTest(options.backupLevel);
  }
}

describe('convertAttachmentToFilePointer', () => {
  describe('not downloaded locally', () => {
    const undownloadedAttachment = composeAttachment({ path: undefined });
    it('returns invalidAttachmentLocator if missing critical decryption info', async () => {
      await testAttachmentToFilePointer(
        {
          ...undownloadedAttachment,
          key: undefined,
        },
        filePointerWithInvalidLocator
      );
      await testAttachmentToFilePointer(
        {
          ...undownloadedAttachment,
          digest: undefined,
        },
        filePointerWithInvalidLocator
      );
    });
    describe('attachment does not have attachment.backupLocator', () => {
      it('returns attachmentLocator, regardless of backupLevel or backup tier status', async () => {
        await testAttachmentToFilePointer(
          undownloadedAttachment,
          filePointerWithAttachmentLocator,
          { backupCdnNumber: 3 }
        );
      });

      it('returns invalidAttachmentLocator if missing critical locator info', async () => {
        await testAttachmentToFilePointer(
          {
            ...undownloadedAttachment,
            cdnKey: undefined,
          },
          filePointerWithInvalidLocator
        );
        await testAttachmentToFilePointer(
          {
            ...undownloadedAttachment,
            cdnNumber: undefined,
          },
          filePointerWithInvalidLocator
        );
      });
    });
    describe('attachment has attachment.backupLocator', () => {
      const undownloadedAttachmentWithBackupLocator = {
        ...undownloadedAttachment,
        backupLocator: { mediaName: defaultMediaName },
      };

      it('returns backupLocator if backupLevel is Media', async () => {
        await testAttachmentToFilePointer(
          undownloadedAttachmentWithBackupLocator,
          filePointerWithBackupLocator,
          { backupLevel: BackupLevel.Media }
        );
      });

      it('returns backupLocator even if missing transit CDN info', async () => {
        // Even if missing transit CDNKey
        await testAttachmentToFilePointer(
          { ...undownloadedAttachmentWithBackupLocator, cdnKey: undefined },
          new Backups.FilePointer({
            ...filePointerWithBackupLocator,
            backupLocator: new Backups.FilePointer.BackupLocator({
              ...defaultBackupLocator,
              transitCdnKey: undefined,
            }),
          }),
          { backupLevel: BackupLevel.Media }
        );
      });

      it('returns attachmentLocator if backupLevel is Messages', async () => {
        await testAttachmentToFilePointer(
          undownloadedAttachmentWithBackupLocator,
          filePointerWithAttachmentLocator,
          { backupLevel: BackupLevel.Messages }
        );
      });
    });
  });
  describe('downloaded locally', () => {
    const downloadedAttachment = composeAttachment();
    describe('BackupLevel.Messages', () => {
      it('returns attachmentLocator', async () => {
        await testAttachmentToFilePointer(
          downloadedAttachment,
          filePointerWithAttachmentLocator,
          { backupLevel: BackupLevel.Messages }
        );
      });
      it('returns invalidAttachmentLocator if missing critical locator info', async () => {
        await testAttachmentToFilePointer(
          {
            ...downloadedAttachment,
            cdnKey: undefined,
          },
          filePointerWithInvalidLocator,
          { backupLevel: BackupLevel.Messages }
        );
        await testAttachmentToFilePointer(
          {
            ...downloadedAttachment,
            cdnNumber: undefined,
          },
          filePointerWithInvalidLocator,
          { backupLevel: BackupLevel.Messages }
        );
      });
      it('returns invalidAttachmentLocator if missing critical decryption info', async () => {
        await testAttachmentToFilePointer(
          {
            ...downloadedAttachment,
            key: undefined,
          },
          filePointerWithInvalidLocator,
          { backupLevel: BackupLevel.Messages }
        );
        await testAttachmentToFilePointer(
          {
            ...downloadedAttachment,
            digest: undefined,
          },
          filePointerWithInvalidLocator,
          { backupLevel: BackupLevel.Messages }
        );
      });
    });
    describe('BackupLevel.Media', () => {
      describe('if missing critical decryption info', () => {
        const FILE_PATH = join(__dirname, '../../../fixtures/ghost-kitty.mp4');

        let sandbox: sinon.SinonSandbox;

        beforeEach(() => {
          sandbox = sinon.createSandbox();
          sandbox
            .stub(window.Signal.Migrations, 'getAbsoluteAttachmentPath')
            .callsFake(relPath => {
              if (relPath === downloadedAttachment.path) {
                return FILE_PATH;
              }
              return relPath;
            });
        });

        afterEach(() => {
          sandbox.restore();
        });

        it('generates new key & digest and removes existing CDN info', async () => {
          const result = await convertAttachmentToFilePointer({
            attachment: {
              ...downloadedAttachment,
              key: undefined,
            },
            backupLevel: BackupLevel.Media,
            getBackupTierInfo: () => ({ isInBackupTier: false }),
          });
          const newKey = result.backupLocator?.key;
          const newDigest = result.backupLocator?.digest;

          strictAssert(newDigest, 'must create new digest');
          assert.deepStrictEqual(
            result,
            new Backups.FilePointer({
              ...filePointerWithBackupLocator,
              backupLocator: new Backups.FilePointer.BackupLocator({
                ...defaultBackupLocator,
                key: newKey,
                digest: newDigest,
                mediaName: Bytes.toBase64(newDigest),
                transitCdnKey: undefined,
                transitCdnNumber: undefined,
              }),
            })
          );
        });
      });

      it('returns BackupLocator, with cdnNumber if in backup tier already', async () => {
        await testAttachmentToFilePointer(
          downloadedAttachment,
          new Backups.FilePointer({
            ...filePointerWithBackupLocator,
            backupLocator: new Backups.FilePointer.BackupLocator({
              ...defaultBackupLocator,
              cdnNumber: 12,
            }),
          }),
          { backupLevel: BackupLevel.Media, backupCdnNumber: 12 }
        );
      });

      it('returns BackupLocator, with empty cdnNumber if not in backup tier', async () => {
        await testAttachmentToFilePointer(
          downloadedAttachment,
          filePointerWithBackupLocator,
          { backupLevel: BackupLevel.Media }
        );
      });
    });
  });
});
