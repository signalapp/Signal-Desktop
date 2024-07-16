// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { IMAGE_PNG } from '../../types/MIME';
import {
  AttachmentPermanentlyUndownloadableError,
  downloadAttachment,
} from '../../util/downloadAttachment';
import { MediaTier } from '../../types/AttachmentDownload';
import { HTTPError } from '../../textsecure/Errors';
import { getCdnNumberForBackupTier } from '../../textsecure/downloadAttachment';
import { MASTER_KEY } from '../backup/helpers';
import { getMediaIdFromMediaName } from '../../services/backups/util/mediaId';
import { AttachmentVariant } from '../../types/Attachment';

describe('utils/downloadAttachment', () => {
  const baseAttachment = {
    size: 100,
    contentType: IMAGE_PNG,
    digest: 'digest',
  };

  let sandbox: sinon.SinonSandbox;
  const fakeServer = {};
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.stub(window, 'textsecure').value({ server: fakeServer });
  });
  afterEach(() => {
    sandbox.restore();
  });

  it('downloads from transit tier first if no backup information', async () => {
    const stubDownload = sinon.stub();
    const attachment = {
      ...baseAttachment,
      cdnKey: 'cdnKey',
      cdnNumber: 2,
    };
    await downloadAttachment({
      attachment,
      dependencies: {
        downloadAttachmentFromServer: stubDownload,
      },
    });
    assert.equal(stubDownload.callCount, 1);
    assert.deepEqual(stubDownload.getCall(0).args, [
      fakeServer,
      attachment,
      {
        mediaTier: MediaTier.STANDARD,
        variant: AttachmentVariant.Default,
        logPrefix: '[REDACTED]est',
      },
    ]);
  });

  it('throw permanently missing error if attachment fails with 404 and no backup information', async () => {
    const stubDownload = sinon
      .stub()
      .onFirstCall()
      .throws(new HTTPError('not found', { code: 404, headers: {} }));

    const attachment = {
      ...baseAttachment,
      cdnKey: 'cdnKey',
      cdnNumber: 2,
    };
    await assert.isRejected(
      downloadAttachment({
        attachment,
        dependencies: {
          downloadAttachmentFromServer: stubDownload,
        },
      }),
      AttachmentPermanentlyUndownloadableError
    );

    assert.equal(stubDownload.callCount, 1);
    assert.deepEqual(stubDownload.getCall(0).args, [
      fakeServer,
      attachment,
      {
        mediaTier: MediaTier.STANDARD,
        variant: AttachmentVariant.Default,
        logPrefix: '[REDACTED]est',
      },
    ]);
  });

  it('downloads from backup tier first if there is backup information', async () => {
    const stubDownload = sinon.stub();
    const attachment = {
      ...baseAttachment,
      cdnKey: 'cdnKey',
      cdnNumber: 2,
      backupLocator: {
        mediaName: 'medianame',
      },
    };
    await downloadAttachment({
      attachment,
      dependencies: {
        downloadAttachmentFromServer: stubDownload,
      },
    });
    assert.equal(stubDownload.callCount, 1);
    assert.deepEqual(stubDownload.getCall(0).args, [
      fakeServer,
      attachment,
      {
        mediaTier: MediaTier.BACKUP,
        variant: AttachmentVariant.Default,
        logPrefix: '[REDACTED]est',
      },
    ]);
  });

  it('falls back to transit tier if backup download fails with 404', async () => {
    const stubDownload = sinon
      .stub()
      .onFirstCall()
      .throws(new HTTPError('not found', { code: 404, headers: {} }));

    const attachment = {
      ...baseAttachment,
      cdnKey: 'cdnKey',
      cdnNumber: 2,
      backupLocator: {
        mediaName: 'medianame',
      },
    };
    await downloadAttachment({
      attachment,
      dependencies: {
        downloadAttachmentFromServer: stubDownload,
      },
    });
    assert.equal(stubDownload.callCount, 2);
    assert.deepEqual(stubDownload.getCall(0).args, [
      fakeServer,
      attachment,
      {
        mediaTier: MediaTier.BACKUP,
        variant: AttachmentVariant.Default,
        logPrefix: '[REDACTED]est',
      },
    ]);
    assert.deepEqual(stubDownload.getCall(1).args, [
      fakeServer,
      attachment,
      {
        mediaTier: MediaTier.STANDARD,
        variant: AttachmentVariant.Default,
        logPrefix: '[REDACTED]est',
      },
    ]);
  });

  it('falls back to transit tier if backup download fails with any other error', async () => {
    const stubDownload = sinon
      .stub()
      .onFirstCall()
      .throws(new Error('could not decrypt!'));

    const attachment = {
      ...baseAttachment,
      cdnKey: 'cdnKey',
      cdnNumber: 2,
      backupLocator: {
        mediaName: 'medianame',
      },
    };
    await downloadAttachment({
      attachment,
      dependencies: {
        downloadAttachmentFromServer: stubDownload,
      },
    });
    assert.equal(stubDownload.callCount, 2);
    assert.deepEqual(stubDownload.getCall(0).args, [
      fakeServer,
      attachment,
      {
        mediaTier: MediaTier.BACKUP,
        variant: AttachmentVariant.Default,
        logPrefix: '[REDACTED]est',
      },
    ]);
    assert.deepEqual(stubDownload.getCall(1).args, [
      fakeServer,
      attachment,
      {
        mediaTier: MediaTier.STANDARD,
        variant: AttachmentVariant.Default,
        logPrefix: '[REDACTED]est',
      },
    ]);
  });

  it('does not throw permanently missing error if not found on transit tier but there is backuplocator', async () => {
    const stubDownload = sinon
      .stub()
      .throws(new HTTPError('not found', { code: 404, headers: {} }));

    const attachment = {
      ...baseAttachment,
      cdnKey: 'cdnKey',
      cdnNumber: 2,
      backupLocator: {
        mediaName: 'medianame',
      },
    };

    await assert.isRejected(
      downloadAttachment({
        attachment,
        dependencies: {
          downloadAttachmentFromServer: stubDownload,
        },
      }),
      HTTPError
    );
    assert.equal(stubDownload.callCount, 2);
    assert.deepEqual(stubDownload.getCall(0).args, [
      fakeServer,
      attachment,
      {
        mediaTier: MediaTier.BACKUP,
        variant: AttachmentVariant.Default,
        logPrefix: '[REDACTED]est',
      },
    ]);
    assert.deepEqual(stubDownload.getCall(1).args, [
      fakeServer,
      attachment,
      {
        mediaTier: MediaTier.STANDARD,
        variant: AttachmentVariant.Default,
        logPrefix: '[REDACTED]est',
      },
    ]);
  });
});

describe('getCdnNumberForBackupTier', () => {
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

  afterEach(async () => {
    await window.Signal.Data.clearAllBackupCdnObjectMetadata();
    sandbox.restore();
  });

  const baseAttachment = {
    size: 100,
    contentType: IMAGE_PNG,
  };
  it('uses cdnNumber on attachment', async () => {
    const result = await getCdnNumberForBackupTier({
      ...baseAttachment,
      backupLocator: { mediaName: 'mediaName', cdnNumber: 4 },
    });
    assert.equal(result, 4);
  });
  it('uses default cdn number if none on attachment', async () => {
    const result = await getCdnNumberForBackupTier({
      ...baseAttachment,
      backupLocator: { mediaName: 'mediaName' },
    });
    assert.equal(result, 3);
  });
  it('uses cdn number in DB if none on attachment', async () => {
    await window.Signal.Data.saveBackupCdnObjectMetadata([
      {
        mediaId: getMediaIdFromMediaName('mediaName').string,
        cdnNumber: 42,
        sizeOnBackupCdn: 128,
      },
    ]);
    const result = await getCdnNumberForBackupTier({
      ...baseAttachment,
      backupLocator: { mediaName: 'mediaName' },
    });
    assert.equal(result, 42);
  });
});
