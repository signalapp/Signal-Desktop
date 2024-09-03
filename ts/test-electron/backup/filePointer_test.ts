// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from 'chai';
import Long from 'long';
import { join } from 'path';
import * as sinon from 'sinon';
import { BackupLevel } from '@signalapp/libsignal-client/zkgroup';
import { DataWriter } from '../../sql/Client';
import { Backups } from '../../protobuf';
import {
  getFilePointerForAttachment,
  convertFilePointerToAttachment,
  maybeGetBackupJobForAttachmentAndFilePointer,
} from '../../services/backups/util/filePointers';
import { APPLICATION_OCTET_STREAM, IMAGE_PNG } from '../../types/MIME';
import * as Bytes from '../../Bytes';
import type { AttachmentType } from '../../types/Attachment';
import { strictAssert } from '../../util/assert';
import type { GetBackupCdnInfoType } from '../../services/backups/util/mediaId';
import { MASTER_KEY } from './helpers';
import { getRandomBytes } from '../../Crypto';

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
      }),
      { _createName: () => 'downloadPath' }
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
      downloadPath: 'downloadPath',
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
      }),
      { _createName: () => 'downloadPath' }
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
      downloadPath: 'downloadPath',
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
      }),
      { _createName: () => 'downloadPath' }
    );

    assert.deepStrictEqual(result, {
      contentType: APPLICATION_OCTET_STREAM,
      size: 0,
      downloadPath: 'downloadPath',
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

const defaultDigest = Bytes.fromBase64('digest');
const defaultMediaName = Bytes.toHex(defaultDigest);

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
    digest: Bytes.toBase64(defaultDigest),
    iv: 'iv',
    width: 100,
    height: 100,
    blurHash: 'blurhash',
    fileName: 'filename',
    caption: 'caption',
    incrementalMac: 'incrementalMac',
    incrementalMacChunkSize: 1000,
    uploadTimestamp: 1234,
    localKey: Bytes.toBase64(getRandomBytes(32)),
    version: 2,
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
  digest: defaultDigest,
  size: 100,
  uploadTimestamp: Long.fromNumber(1234),
});

const defaultBackupLocator = new Backups.FilePointer.BackupLocator({
  mediaName: defaultMediaName,
  cdnNumber: null,
  key: Bytes.fromBase64('key'),
  digest: defaultDigest,
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
  options?: {
    backupLevel?: BackupLevel;
    backupCdnNumber?: number;
    updatedAttachment?: AttachmentType;
  }
) {
  async function _doTest(withBackupLevel: BackupLevel) {
    assert.deepEqual(
      await getFilePointerForAttachment({
        attachment,
        backupLevel: withBackupLevel,
        getBackupCdnInfo: async _mediaId => {
          if (options?.backupCdnNumber != null) {
            return { isInBackupTier: true, cdnNumber: options.backupCdnNumber };
          }
          return { isInBackupTier: false };
        },
      }),
      {
        filePointer,
        ...(options?.updatedAttachment
          ? { updatedAttachment: options?.updatedAttachment }
          : {}),
      }
    );
  }

  if (!options?.backupLevel) {
    await _doTest(BackupLevel.Messages);
    await _doTest(BackupLevel.Media);
  } else {
    await _doTest(options.backupLevel);
  }
}

const notInBackupCdn: GetBackupCdnInfoType = async () => {
  return { isInBackupTier: false };
};

describe('getFilePointerForAttachment', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(window.storage, 'get').callsFake(key => {
      if (key === 'masterKey') {
        return MASTER_KEY;
      }
      return undefined;
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

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
      describe('if missing critical decryption / encryption info', () => {
        const FILE_PATH = join(__dirname, '../../../fixtures/ghost-kitty.mp4');
        beforeEach(() => {
          sandbox
            .stub(window.Signal.Migrations, 'getAbsoluteAttachmentPath')
            .callsFake(relPath => {
              if (relPath === downloadedAttachment.path) {
                return FILE_PATH;
              }
              return relPath;
            });
        });

        it('if missing key, generates new key & digest and removes existing CDN info', async () => {
          const { filePointer: result } = await getFilePointerForAttachment({
            attachment: {
              ...downloadedAttachment,
              key: undefined,
            },
            backupLevel: BackupLevel.Media,
            getBackupCdnInfo: notInBackupCdn,
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
                mediaName: Bytes.toHex(newDigest),
                transitCdnKey: undefined,
                transitCdnNumber: undefined,
              }),
            })
          );
        });

        it('if file does not exist at local path, returns invalid attachment locator', async () => {
          await testAttachmentToFilePointer(
            {
              ...downloadedAttachment,
              path: 'no/file/here.png',
              key: undefined,
            },
            filePointerWithInvalidLocator,
            { backupLevel: BackupLevel.Media }
          );
        });

        it('if not on backup tier, and missing iv, regenerates encryption info', async () => {
          const { filePointer: result } = await getFilePointerForAttachment({
            attachment: {
              ...downloadedAttachment,
              iv: undefined,
            },
            backupLevel: BackupLevel.Media,
            getBackupCdnInfo: notInBackupCdn,
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
                mediaName: Bytes.toHex(newDigest),
                transitCdnKey: undefined,
                transitCdnNumber: undefined,
              }),
            })
          );
        });

        it('if on backup tier, and not missing iv, does not regenerate encryption info', async () => {
          await testAttachmentToFilePointer(
            {
              ...downloadedAttachment,
              iv: undefined,
            },
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

describe('getBackupJobForAttachmentAndFilePointer', async () => {
  beforeEach(async () => {
    await window.storage.put('masterKey', Bytes.toBase64(getRandomBytes(32)));
  });
  afterEach(async () => {
    await DataWriter.removeAll();
  });
  const attachment = composeAttachment();

  it('returns null if filePointer does not have backupLocator', async () => {
    const { filePointer } = await getFilePointerForAttachment({
      attachment,
      backupLevel: BackupLevel.Messages,
      getBackupCdnInfo: notInBackupCdn,
    });
    assert.strictEqual(
      await maybeGetBackupJobForAttachmentAndFilePointer({
        attachment,
        filePointer,
        messageReceivedAt: 100,
        getBackupCdnInfo: notInBackupCdn,
      }),
      null
    );
  });

  it('returns job if filePointer does have backupLocator', async () => {
    const { filePointer, updatedAttachment } =
      await getFilePointerForAttachment({
        attachment,
        backupLevel: BackupLevel.Media,
        getBackupCdnInfo: notInBackupCdn,
      });
    const attachmentToUse = updatedAttachment ?? attachment;
    assert.deepStrictEqual(
      await maybeGetBackupJobForAttachmentAndFilePointer({
        attachment: attachmentToUse,
        filePointer,
        messageReceivedAt: 100,
        getBackupCdnInfo: notInBackupCdn,
      }),
      {
        mediaName: Bytes.toHex(defaultDigest),
        receivedAt: 100,
        type: 'standard',
        data: {
          path: 'path/to/file.png',
          contentType: IMAGE_PNG,
          keys: 'key',
          digest: Bytes.toBase64(defaultDigest),
          iv: 'iv',
          size: 100,
          localKey: attachment.localKey,
          version: attachment.version,
          transitCdnInfo: {
            cdnKey: 'cdnKey',
            cdnNumber: 2,
            uploadTimestamp: 1234,
          },
        },
      }
    );
  });
  it('does not return job if already in backup tier', async () => {
    const isInBackupTier = async () => ({
      isInBackupTier: true,
      cdnNumber: 42,
    });
    const { filePointer } = await getFilePointerForAttachment({
      attachment,
      backupLevel: BackupLevel.Media,
      getBackupCdnInfo: isInBackupTier,
    });
    assert.deepStrictEqual(
      await maybeGetBackupJobForAttachmentAndFilePointer({
        attachment,
        filePointer,
        messageReceivedAt: 100,
        getBackupCdnInfo: isInBackupTier,
      }),
      null
    );
  });
});
