// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import lodash from 'lodash';

import { DataWriter } from '../../sql/Client.preload.ts';
import { IMAGE_PNG } from '../../types/MIME.std.ts';
import {
  downloadAttachment,
  isDownloadableOrBackfillable,
} from '../../util/downloadAttachment.preload.ts';
import { MediaTier } from '../../types/AttachmentDownload.std.ts';
import { HTTPError } from '../../types/HTTPError.std.ts';
import { getCdnNumberForBackupTier } from '../../textsecure/downloadAttachment.preload.ts';
import { MASTER_KEY, MEDIA_ROOT_KEY } from '../backup/helpers.preload.ts';
import { getMediaIdFromMediaName } from '../../services/backups/util/mediaId.preload.ts';
import {
  AttachmentUndownloadableFromTransitTierError,
  AttachmentVariant,
} from '../../types/Attachment.std.ts';
import { updateRemoteConfig } from '../../test-helpers/RemoteConfigStub.dom.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import { DAY, HOUR } from '../../util/durations/constants.std.ts';
import {
  testAttachmentDigest,
  testAttachmentKey,
  testPlaintextHash,
} from '../../test-helpers/attachments.node.ts';

const { noop } = lodash;

describe('utils/downloadAttachment', () => {
  const baseAttachment = {
    size: 100,
    contentType: IMAGE_PNG,
    digest: testAttachmentDigest(),
    cdnKey: 'cdnKey',
    cdnNumber: 2,
    key: testAttachmentKey(),
  };
  const backupableAttachment = {
    ...baseAttachment,
    plaintextHash: testPlaintextHash(),
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
        messageExpiresAt: null,
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

  it('throws undownloadable from transit tier error on 404', async () => {
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
          messageExpiresAt: Date.now() + 2 * DAY,
          logId: '',
        },
        dependencies: {
          downloadAttachmentFromLocalBackup: stubDownload,
          downloadAttachmentFromServer: stubDownload,
        },
      }),
      AttachmentUndownloadableFromTransitTierError
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

  it('throws undownloadable from transit error on 404 from backup and no transit info', async () => {
    const stubDownload = sinon
      .stub()
      .throws(new HTTPError('not found', { code: 404, headers: {} }));

    const attachment = { ...backupableAttachment, cdnKey: undefined };
    await assert.isRejected(
      downloadAttachment({
        attachment,
        options: {
          hasMediaBackups: true,
          onSizeUpdate: noop,
          abortSignal: abortController.signal,
          messageExpiresAt: Date.now() + HOUR,
          logId: '',
        },
        dependencies: {
          downloadAttachmentFromLocalBackup: stubDownload,
          downloadAttachmentFromServer: stubDownload,
        },
      }),
      AttachmentUndownloadableFromTransitTierError
    );

    assert.equal(stubDownload.callCount, 1);
  });

  it('throws undownloadable from transit error if it has no information to download from', async () => {
    const stubDownload = sinon.stub();
    const attachment = { ...baseAttachment, cdnKey: undefined };
    await assert.isRejected(
      downloadAttachment({
        attachment,
        options: {
          hasMediaBackups: true,
          onSizeUpdate: noop,
          abortSignal: abortController.signal,
          messageExpiresAt: Date.now() + DAY,
          logId: '',
        },
        dependencies: {
          downloadAttachmentFromLocalBackup: stubDownload,
          downloadAttachmentFromServer: stubDownload,
        },
      }),
      AttachmentUndownloadableFromTransitTierError
    );

    assert.equal(stubDownload.callCount, 0);
  });

  it('throws undownloadable from transit error on 403 from cdn 0', async () => {
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
          messageExpiresAt: null,
          logId: '',
        },
        dependencies: {
          downloadAttachmentFromLocalBackup: stubDownload,
          downloadAttachmentFromServer: stubDownload,
        },
      }),
      AttachmentUndownloadableFromTransitTierError
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

  it('throw undownloadable from transit error missing error on 403 from missing cdn number', async () => {
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
          messageExpiresAt: null,
          logId: '',
        },
        dependencies: {
          downloadAttachmentFromLocalBackup: stubDownload,
          downloadAttachmentFromServer: stubDownload,
        },
      }),
      AttachmentUndownloadableFromTransitTierError
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
        messageExpiresAt: null,
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

  it('falls back to transit tier if backup download 404s', async () => {
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
        messageExpiresAt: null,
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
        messageExpiresAt: null,
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

  describe('isDownloadableOrBackfillable', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      sandbox
        .stub(window.ConversationController, 'areWePrimaryDevice')
        .returns(false);
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('returns true for transit-tier attachments without media backups', () => {
      assert.isTrue(
        isDownloadableOrBackfillable({
          attachment: baseAttachment,
          attachmentType: 'attachment',
          isStory: false,
          hasMediaBackups: false,
        })
      );
    });

    it('returns true for supported attachments that can be backfilled', () => {
      assert.isTrue(
        isDownloadableOrBackfillable({
          attachment: {
            size: 100,
            contentType: IMAGE_PNG,
          },
          attachmentType: 'attachment',
          isStory: false,
          hasMediaBackups: false,
        })
      );
    });

    it('does not backfill unsupported attachment types or stories', () => {
      const attachment = {
        size: 100,
        contentType: IMAGE_PNG,
      };

      for (const attachmentType of ['contact', 'preview', 'quote'] as const) {
        assert.isFalse(
          isDownloadableOrBackfillable({
            attachment,
            attachmentType,
            isStory: false,
            hasMediaBackups: false,
          })
        );
      }

      assert.isFalse(
        isDownloadableOrBackfillable({
          attachment,
          attachmentType: 'attachment',
          isStory: true,
          hasMediaBackups: false,
        })
      );
    });

    it('depends on hasMediaBackups for backup-only attachments', () => {
      const attachment = {
        size: 100,
        contentType: IMAGE_PNG,
        key: testAttachmentKey(),
        plaintextHash: testPlaintextHash(),
      };

      assert.isFalse(
        isDownloadableOrBackfillable({
          attachment,
          attachmentType: 'preview',
          isStory: false,
          hasMediaBackups: false,
        })
      );
      assert.isTrue(
        isDownloadableOrBackfillable({
          attachment,
          attachmentType: 'preview',
          isStory: false,
          hasMediaBackups: true,
        })
      );
    });

    it('returns false if undownloadable and backfill already errored', () => {
      assert.isFalse(
        isDownloadableOrBackfillable({
          attachment: {
            ...baseAttachment,
            cdnKey: undefined,
            backfillError: true,
          },
          attachmentType: 'attachment',
          isStory: false,
          hasMediaBackups: true,
        })
      );
    });
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
