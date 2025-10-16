// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import lodash from 'lodash';

import { DataWriter } from '../../sql/Client.preload.js';
import { IMAGE_PNG } from '../../types/MIME.std.js';
import { downloadAttachment } from '../../util/downloadAttachment.preload.js';
import { MediaTier } from '../../types/AttachmentDownload.std.js';
import { HTTPError } from '../../types/HTTPError.std.js';
import { getCdnNumberForBackupTier } from '../../textsecure/downloadAttachment.preload.js';
import { MASTER_KEY, MEDIA_ROOT_KEY } from '../backup/helpers.preload.js';
import { getMediaIdFromMediaName } from '../../services/backups/util/mediaId.preload.js';
import {
  AttachmentVariant,
  AttachmentPermanentlyUndownloadableError,
} from '../../types/Attachment.std.js';
import { updateRemoteConfig } from '../../test-helpers/RemoteConfigStub.dom.js';
import { toHex, toBase64 } from '../../Bytes.std.js';
import { generateAttachmentKeys } from '../../AttachmentCrypto.node.js';
import { getRandomBytes } from '../../Crypto.node.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';

const { noop } = lodash;

describe('utils/downloadAttachment', () => {
  const baseAttachment = {
    size: 100,
    contentType: IMAGE_PNG,
    digest: 'digest',
    cdnKey: 'cdnKey',
    cdnNumber: 2,
    key: toBase64(generateAttachmentKeys()),
  };
  const backupableAttachment = {
    ...baseAttachment,
    plaintextHash: toHex(getRandomBytes(32)),
  };
  const abortController = new AbortController();

  function assertDownloadArgs(
    actual: Array<unknown>,
    expected: Array<unknown>
  ) {
    assert.deepStrictEqual(actual.slice(1), expected);
  }

  it('downloads from transit tier first if no backup information', async () => {
    const stubDownload = sinon.stub();
    const attachment = baseAttachment;
    await downloadAttachment({
      attachment,
      options: {
        hasMediaBackups: true,
        onSizeUpdate: noop,
        abortSignal: abortController.signal,
        logId: '',
      },
      dependencies: {
        downloadAttachmentFromLocalBackup: stubDownload,
        downloadAttachmentFromServer: stubDownload,
      },
    });
    assert.equal(stubDownload.callCount, 1);
    assertDownloadArgs(stubDownload.getCall(0).args, [
      { attachment, mediaTier: MediaTier.STANDARD },
      {
        variant: AttachmentVariant.Default,
        onSizeUpdate: noop,
        abortSignal: abortController.signal,
        logId: '',
      },
    ]);
  });

  it('throw permanently missing error if attachment fails with 404 and no backup information', async () => {
    const stubDownload = sinon
      .stub()
      .onFirstCall()
      .throws(new HTTPError('not found', { code: 404, headers: {} }));

    const attachment = baseAttachment;
    await assert.isRejected(
      downloadAttachment({
        attachment,
        options: {
          hasMediaBackups: true,
          onSizeUpdate: noop,
          abortSignal: abortController.signal,
          logId: '',
        },
        dependencies: {
          downloadAttachmentFromLocalBackup: stubDownload,
          downloadAttachmentFromServer: stubDownload,
        },
      }),
      AttachmentPermanentlyUndownloadableError
    );

    assert.equal(stubDownload.callCount, 1);
    assertDownloadArgs(stubDownload.getCall(0).args, [
      { attachment, mediaTier: MediaTier.STANDARD },
      {
        variant: AttachmentVariant.Default,
        onSizeUpdate: noop,
        abortSignal: abortController.signal,
        logId: '',
      },
    ]);
  });

  it('throw permanently missing error if attachment fails with 403 from cdn 0 and no backup information', async () => {
    const stubDownload = sinon
      .stub()
      .onFirstCall()
      .throws(new HTTPError('not found', { code: 403, headers: {} }));

    const attachment = { ...baseAttachment, cdnNumber: 0 };
    await assert.isRejected(
      downloadAttachment({
        attachment,
        options: {
          hasMediaBackups: true,
          onSizeUpdate: noop,
          abortSignal: abortController.signal,
          logId: '',
        },
        dependencies: {
          downloadAttachmentFromLocalBackup: stubDownload,
          downloadAttachmentFromServer: stubDownload,
        },
      }),
      AttachmentPermanentlyUndownloadableError
    );

    assert.equal(stubDownload.callCount, 1);
    assertDownloadArgs(stubDownload.getCall(0).args, [
      { attachment, mediaTier: MediaTier.STANDARD },
      {
        variant: AttachmentVariant.Default,
        onSizeUpdate: noop,
        abortSignal: abortController.signal,
        logId: '',
      },
    ]);
  });

  it('throw permanently missing error if attachment fails with 403 with no cdn number and no backup information', async () => {
    const stubDownload = sinon
      .stub()
      .onFirstCall()
      .throws(new HTTPError('not found', { code: 403, headers: {} }));

    // nullish cdn number gets converted to 0
    const attachment = { ...baseAttachment, cdnNumber: undefined };
    await assert.isRejected(
      downloadAttachment({
        attachment,
        options: {
          hasMediaBackups: true,
          onSizeUpdate: noop,
          abortSignal: abortController.signal,
          logId: '',
        },
        dependencies: {
          downloadAttachmentFromLocalBackup: stubDownload,
          downloadAttachmentFromServer: stubDownload,
        },
      }),
      AttachmentPermanentlyUndownloadableError
    );
  });

  it('downloads from backup tier first if there is backup information', async () => {
    const stubDownload = sinon.stub();
    const attachment = backupableAttachment;
    await downloadAttachment({
      attachment,
      options: {
        hasMediaBackups: true,
        onSizeUpdate: noop,
        abortSignal: abortController.signal,
        logId: '',
      },
      dependencies: {
        downloadAttachmentFromLocalBackup: stubDownload,
        downloadAttachmentFromServer: stubDownload,
      },
    });
    assert.equal(stubDownload.callCount, 1);
    assertDownloadArgs(stubDownload.getCall(0).args, [
      { attachment, mediaTier: MediaTier.BACKUP },
      {
        variant: AttachmentVariant.Default,
        onSizeUpdate: noop,
        abortSignal: abortController.signal,
        logId: '',
      },
    ]);
  });

  it('falls back to transit tier if backup download fails with 404', async () => {
    const stubDownload = sinon
      .stub()
      .onFirstCall()
      .throws(new HTTPError('not found', { code: 404, headers: {} }));

    const attachment = backupableAttachment;
    await downloadAttachment({
      attachment,
      options: {
        hasMediaBackups: true,
        onSizeUpdate: noop,
        abortSignal: abortController.signal,
        logId: '',
      },
      dependencies: {
        downloadAttachmentFromLocalBackup: stubDownload,
        downloadAttachmentFromServer: stubDownload,
      },
    });
    assert.equal(stubDownload.callCount, 2);
    assertDownloadArgs(stubDownload.getCall(0).args, [
      { attachment, mediaTier: MediaTier.BACKUP },
      {
        variant: AttachmentVariant.Default,
        onSizeUpdate: noop,
        abortSignal: abortController.signal,
        logId: '',
      },
    ]);
    assertDownloadArgs(stubDownload.getCall(1).args, [
      {
        attachment,
        mediaTier: MediaTier.STANDARD,
      },
      {
        variant: AttachmentVariant.Default,
        onSizeUpdate: noop,
        abortSignal: abortController.signal,
        logId: '',
      },
    ]);
  });

  it('falls back to transit tier if backup download fails with any other error', async () => {
    const stubDownload = sinon
      .stub()
      .onFirstCall()
      .throws(new Error('could not decrypt!'));

    const attachment = backupableAttachment;
    await downloadAttachment({
      attachment,
      options: {
        hasMediaBackups: true,
        onSizeUpdate: noop,
        abortSignal: abortController.signal,
        logId: '',
      },
      dependencies: {
        downloadAttachmentFromLocalBackup: stubDownload,
        downloadAttachmentFromServer: stubDownload,
      },
    });
    assert.equal(stubDownload.callCount, 2);
    assertDownloadArgs(stubDownload.getCall(0).args, [
      { attachment, mediaTier: MediaTier.BACKUP },
      {
        variant: AttachmentVariant.Default,
        onSizeUpdate: noop,
        abortSignal: abortController.signal,
        logId: '',
      },
    ]);
    assertDownloadArgs(stubDownload.getCall(1).args, [
      { attachment, mediaTier: MediaTier.STANDARD },
      {
        variant: AttachmentVariant.Default,
        onSizeUpdate: noop,
        abortSignal: abortController.signal,
        logId: '',
      },
    ]);
  });

  it('does not throw permanently missing error if not found on transit tier but attachment is backupable', async () => {
    const stubDownload = sinon
      .stub()
      .throws(new HTTPError('not found', { code: 404, headers: {} }));

    const attachment = backupableAttachment;

    await assert.isRejected(
      downloadAttachment({
        attachment,
        options: {
          hasMediaBackups: true,
          onSizeUpdate: noop,
          abortSignal: abortController.signal,
          logId: '',
        },
        dependencies: {
          downloadAttachmentFromLocalBackup: stubDownload,
          downloadAttachmentFromServer: stubDownload,
        },
      }),
      HTTPError
    );
    assert.equal(stubDownload.callCount, 2);
    assertDownloadArgs(stubDownload.getCall(0).args, [
      { attachment, mediaTier: MediaTier.BACKUP },
      {
        variant: AttachmentVariant.Default,
        onSizeUpdate: noop,
        abortSignal: abortController.signal,
        logId: '',
      },
    ]);
    assertDownloadArgs(stubDownload.getCall(1).args, [
      { attachment, mediaTier: MediaTier.STANDARD },
      {
        variant: AttachmentVariant.Default,
        onSizeUpdate: noop,
        abortSignal: abortController.signal,
        logId: '',
      },
    ]);
  });
});

describe('getCdnNumberForBackupTier', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(async () => {
    await DataWriter.removeAll();
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
    await updateRemoteConfig([
      {
        name: 'global.backups.mediaTierFallbackCdnNumber',
        value: '42',
      },
    ]);
  });

  afterEach(async () => {
    await DataWriter.clearAllBackupCdnObjectMetadata();
    sandbox.restore();
    await updateRemoteConfig([]);
  });

  const baseAttachment = {
    size: 100,
    contentType: IMAGE_PNG,
    plaintextHash: 'plaintextHash',
    key: 'key',
  };
  it('uses cdnNumber on attachment', async () => {
    const result = await getCdnNumberForBackupTier({
      ...baseAttachment,
      backupCdnNumber: 4,
    });
    assert.equal(result, 4);
  });
  it('uses default cdn number if none on attachment', async () => {
    const result = await getCdnNumberForBackupTier({
      ...baseAttachment,
    });
    assert.equal(result, 42);
  });
  it('uses cdn number in DB if none on attachment', async () => {
    await DataWriter.saveBackupCdnObjectMetadata([
      {
        mediaId: getMediaIdFromMediaName('mediaName').string,
        cdnNumber: 42,
        sizeOnBackupCdn: 128,
      },
    ]);
    const result = await getCdnNumberForBackupTier({
      ...baseAttachment,
    });
    assert.equal(result, 42);
  });
});
