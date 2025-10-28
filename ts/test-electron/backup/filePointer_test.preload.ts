// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from 'chai';
import Long from 'long';
import * as sinon from 'sinon';
import { BackupLevel } from '@signalapp/libsignal-client/zkgroup.js';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

import { Backups } from '../../protobuf/index.std.js';

import {
  getFilePointerForAttachment,
  convertFilePointerToAttachment,
} from '../../services/backups/util/filePointers.preload.js';
import { IMAGE_PNG } from '../../types/MIME.std.js';
import * as Bytes from '../../Bytes.std.js';
import type { AttachmentType } from '../../types/Attachment.std.js';
import { MASTER_KEY, MEDIA_ROOT_KEY } from './helpers.preload.js';
import { generateKeys } from '../../AttachmentCrypto.node.js';
import type { GetBackupCdnInfoType } from '../../services/backups/util/mediaId.preload.js';
import { strictAssert } from '../../util/assert.std.js';
import { isValidAttachmentKey } from '../../types/Crypto.std.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

describe('convertFilePointerToAttachment', () => {
  const commonFilePointerProps = {
    contentType: 'image/png',
    width: 100,
    height: 100,
    blurHash: 'blurhash',
    fileName: 'filename',
    caption: 'caption',
    incrementalMac: Bytes.fromString('incrementalMac'),
    incrementalMacChunkSize: 1000,
  };
  const commonAttachmentProps = {
    contentType: IMAGE_PNG,
    width: 100,
    height: 100,
    blurHash: 'blurhash',
    fileName: 'filename',
    caption: 'caption',
    incrementalMac: Bytes.toBase64(Bytes.fromString('incrementalMac')),
    chunkSize: 1000,
  } as const;

  describe('locatorInfo', () => {
    it('processes filepointer with empty locatorInfo', () => {
      const result = convertFilePointerToAttachment(
        new Backups.FilePointer({
          ...commonFilePointerProps,
          locatorInfo: {},
        }),
        { _createName: () => 'downloadPath' }
      );

      assert.deepStrictEqual(result, {
        ...commonAttachmentProps,
        size: 0,
        error: true,
        downloadPath: undefined,
      });
    });
    it('processes filepointer with missing locatorInfo', () => {
      const result = convertFilePointerToAttachment(
        new Backups.FilePointer(commonFilePointerProps),
        { _createName: () => 'downloadPath' }
      );

      assert.deepStrictEqual(result, {
        ...commonAttachmentProps,
        size: 0,
        error: true,
        downloadPath: undefined,
      });
    });

    it('processes locatorInfo with plaintextHash', () => {
      const result = convertFilePointerToAttachment(
        new Backups.FilePointer({
          ...commonFilePointerProps,
          locatorInfo: {
            transitCdnKey: 'cdnKey',
            transitCdnNumber: 42,
            size: 128,
            transitTierUploadTimestamp: Long.fromNumber(12345),
            key: Bytes.fromString('key'),
            plaintextHash: Bytes.fromString('plaintextHash'),
            mediaTierCdnNumber: 43,
          },
        }),
        { _createName: () => 'downloadPath' }
      );

      assert.deepStrictEqual(result, {
        ...commonAttachmentProps,
        size: 128,
        cdnKey: 'cdnKey',
        cdnNumber: 42,
        downloadPath: 'downloadPath',
        digest: undefined,
        key: Bytes.toBase64(Bytes.fromString('key')),
        uploadTimestamp: 12345,
        backupCdnNumber: 43,
        plaintextHash: Bytes.toHex(Bytes.fromString('plaintextHash')),
        localBackupPath: undefined,
        localKey: undefined,
      });
    });
    it('processes locatorInfo with localKey', () => {
      const result = convertFilePointerToAttachment(
        new Backups.FilePointer({
          ...commonFilePointerProps,
          locatorInfo: {
            transitCdnKey: 'cdnKey',
            transitCdnNumber: 42,
            size: 128,
            transitTierUploadTimestamp: Long.fromNumber(12345),
            key: Bytes.fromString('key'),
            plaintextHash: Bytes.fromString('plaintextHash'),
            mediaTierCdnNumber: 43,
            localKey: Bytes.fromString('localKey'),
          },
        }),
        {
          _createName: () => 'downloadPath',
          localBackupSnapshotDir: '/root/backups',
        }
      );

      const mediaName = Bytes.toHex(
        Bytes.concatenate([
          Bytes.fromString('plaintextHash'),
          Bytes.fromString('key'),
        ])
      );
      assert.deepStrictEqual(result, {
        ...commonAttachmentProps,
        size: 128,
        cdnKey: 'cdnKey',
        cdnNumber: 42,
        downloadPath: 'downloadPath',
        key: Bytes.toBase64(Bytes.fromString('key')),
        digest: undefined,
        uploadTimestamp: 12345,
        backupCdnNumber: 43,
        plaintextHash: Bytes.toHex(Bytes.fromString('plaintextHash')),
        localBackupPath: join(
          '/',
          'root',
          'files',
          mediaName.slice(0, 2),
          mediaName
        ),
        localKey: Bytes.toBase64(Bytes.fromString('localKey')),
      });
    });
  });
});

const defaultAttachment = {
  size: 100,
  contentType: IMAGE_PNG,
  cdnKey: 'cdnKey',
  cdnNumber: 2,
  path: 'path/to/file.png',
  key: Bytes.toBase64(randomBytes(64)),
  digest: Bytes.toBase64(randomBytes(32)),
  plaintextHash: Bytes.toHex(randomBytes(32)),
  backupCdnNumber: 42,
  width: 100,
  height: 100,
  blurHash: 'blurhash',
  fileName: 'filename',
  caption: 'caption',
  incrementalMac: 'incrementalMac',
  chunkSize: 1000,
  uploadTimestamp: 1234,
  localKey: Bytes.toBase64(generateKeys()),
  version: 2,
} as const satisfies AttachmentType;

const defaultMediaName = Bytes.toHex(
  Bytes.concatenate([
    Bytes.fromHex(defaultAttachment.plaintextHash),
    Bytes.fromBase64(defaultAttachment.key),
  ])
);

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
const { FilePointer } = Backups;
const { LocatorInfo } = FilePointer;

const notInBackupCdn: GetBackupCdnInfoType = async () => {
  return { isInBackupTier: false };
};
describe('getFilePointerForAttachment', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(itemStorage, 'get').callsFake(key => {
      if (key === 'masterKey') {
        return MASTER_KEY;
      }
      if (key === 'backupMediaRootKey') {
        return MEDIA_ROOT_KEY;
      }
      return undefined;
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('if missing key, generates a new one and removes transit info & digest', async () => {
    const { filePointer } = await getFilePointerForAttachment({
      attachment: { ...defaultAttachment, key: undefined },
      backupLevel: BackupLevel.Paid,
      getBackupCdnInfo: notInBackupCdn,
      messageReceivedAt: 100,
    });

    const key = filePointer.locatorInfo?.key;

    strictAssert(key, 'key exists');
    assert.isTrue(isValidAttachmentKey(Bytes.toBase64(key)));

    assert.deepStrictEqual(
      filePointer,
      new FilePointer({
        ...defaultFilePointer,
        locatorInfo: new LocatorInfo({
          size: 100,
          plaintextHash: Bytes.fromHex(defaultAttachment.plaintextHash),
          key: filePointer.locatorInfo?.key,
        }),
      })
    );
  });

  it('includes transit cdn info', async () => {
    assert.deepEqual(
      await getFilePointerForAttachment({
        attachment: { ...defaultAttachment, plaintextHash: undefined },
        backupLevel: BackupLevel.Paid,
        getBackupCdnInfo: notInBackupCdn,
        messageReceivedAt: 100,
      }),
      {
        filePointer: new FilePointer({
          ...defaultFilePointer,
          locatorInfo: new LocatorInfo({
            encryptedDigest: Bytes.fromBase64(defaultAttachment.digest),
            key: Bytes.fromBase64(defaultAttachment.key),
            size: 100,
            transitCdnKey: 'cdnKey',
            transitCdnNumber: 2,
            transitTierUploadTimestamp: Long.fromNumber(1234),
          }),
        }),
        backupJob: undefined,
      }
    );
  });
  it('includes transit cdn and backup info', async () => {
    assert.deepEqual(
      await getFilePointerForAttachment({
        attachment: defaultAttachment,
        backupLevel: BackupLevel.Free,
        getBackupCdnInfo: notInBackupCdn,
        messageReceivedAt: 100,
      }),
      {
        filePointer: new FilePointer({
          ...defaultFilePointer,
          locatorInfo: new LocatorInfo({
            plaintextHash: Bytes.fromHex(defaultAttachment.plaintextHash),
            key: Bytes.fromBase64(defaultAttachment.key),
            size: 100,
            transitCdnKey: 'cdnKey',
            transitCdnNumber: 2,
            transitTierUploadTimestamp: Long.fromNumber(1234),
            mediaTierCdnNumber: 42,
          }),
        }),
        backupJob: undefined,
      }
    );
  });

  it('includes transit cdn and backup info even if digest is missing', async () => {
    assert.deepEqual(
      await getFilePointerForAttachment({
        attachment: { ...defaultAttachment, digest: undefined },
        backupLevel: BackupLevel.Free,
        getBackupCdnInfo: notInBackupCdn,
        messageReceivedAt: 100,
      }),
      {
        filePointer: new FilePointer({
          ...defaultFilePointer,
          locatorInfo: new LocatorInfo({
            plaintextHash: Bytes.fromHex(defaultAttachment.plaintextHash),
            key: Bytes.fromBase64(defaultAttachment.key),
            size: 100,
            transitCdnKey: 'cdnKey',
            transitCdnNumber: 2,
            transitTierUploadTimestamp: Long.fromNumber(1234),
            mediaTierCdnNumber: 42,
          }),
        }),
        backupJob: undefined,
      }
    );
  });

  it('includes backup info even if transit tier info is missing', async () => {
    assert.deepEqual(
      await getFilePointerForAttachment({
        attachment: { ...defaultAttachment, cdnKey: undefined },
        backupLevel: BackupLevel.Free,
        getBackupCdnInfo: notInBackupCdn,
        messageReceivedAt: 100,
      }),
      {
        filePointer: new FilePointer({
          ...defaultFilePointer,
          locatorInfo: new LocatorInfo({
            plaintextHash: Bytes.fromHex(defaultAttachment.plaintextHash),
            key: Bytes.fromBase64(defaultAttachment.key),
            size: 100,
            mediaTierCdnNumber: 42,
          }),
        }),
        backupJob: undefined,
      }
    );
  });
  it('includes backup job if paid tier', async () => {
    assert.deepEqual(
      await getFilePointerForAttachment({
        attachment: defaultAttachment,
        backupLevel: BackupLevel.Paid,
        getBackupCdnInfo: notInBackupCdn,
        messageReceivedAt: 100,
      }),
      {
        filePointer: new FilePointer({
          ...defaultFilePointer,
          locatorInfo: new LocatorInfo({
            plaintextHash: Bytes.fromHex(defaultAttachment.plaintextHash),
            key: Bytes.fromBase64(defaultAttachment.key),
            size: 100,
            transitCdnKey: 'cdnKey',
            transitCdnNumber: 2,
            transitTierUploadTimestamp: Long.fromNumber(1234),
            mediaTierCdnNumber: 42,
          }),
        }),
        backupJob: {
          data: {
            contentType: defaultAttachment.contentType,
            keys: defaultAttachment.key,
            localKey: defaultAttachment.localKey,
            path: defaultAttachment.path,
            size: defaultAttachment.size,
            transitCdnInfo: {
              cdnKey: defaultAttachment.cdnKey,
              cdnNumber: defaultAttachment.cdnNumber,
              uploadTimestamp: defaultAttachment.uploadTimestamp,
            },
            version: 2,
          },
          mediaName: defaultMediaName,
          receivedAt: 100,
          type: 'standard',
        },
      }
    );
  });
  it('if local backup includes local backup job', async () => {
    assert.deepEqual(
      await getFilePointerForAttachment({
        attachment: defaultAttachment,
        backupLevel: BackupLevel.Paid,
        getBackupCdnInfo: notInBackupCdn,
        messageReceivedAt: 100,
        isLocalBackup: true,
      }),
      {
        filePointer: new FilePointer({
          ...defaultFilePointer,
          locatorInfo: new LocatorInfo({
            plaintextHash: Bytes.fromHex(defaultAttachment.plaintextHash),
            key: Bytes.fromBase64(defaultAttachment.key),
            size: 100,
            transitCdnKey: 'cdnKey',
            transitCdnNumber: 2,
            transitTierUploadTimestamp: Long.fromNumber(1234),
            mediaTierCdnNumber: 42,
          }),
        }),
        backupJob: {
          data: {
            localKey: defaultAttachment.localKey,
            path: defaultAttachment.path,
            size: 100,
          },
          mediaName: defaultMediaName,
          type: 'local',
        },
      }
    );
  });
});
