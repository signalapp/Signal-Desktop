// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'path';
import * as assert from 'assert';
import Sinon from 'sinon';
import { randomBytes } from 'crypto';
import { omit } from 'lodash';
import { readFileSync, statSync } from 'fs';
import type {
  AttachmentType,
  LocallySavedAttachment,
} from '../../types/Attachment';
import { IMAGE_JPEG } from '../../types/MIME';
import {
  encryptAttachmentV2,
  generateAttachmentKeys,
  safeUnlink,
} from '../../AttachmentCrypto';
import { fromBase64, toBase64 } from '../../Bytes';
import { ensureAttachmentIsReencryptable } from '../../util/ensureAttachmentIsReencryptable';
import { strictAssert } from '../../util/assert';
import { writeNewAttachmentData } from '../../windows/attachments';

describe('utils/ensureAttachmentIsReencryptable', async () => {
  const fixturesDir = join(__dirname, '..', '..', '..', 'fixtures');
  const plaintextFilePath = join(fixturesDir, 'cat-screenshot.png');

  const keys = generateAttachmentKeys();
  let digest: Uint8Array;
  let iv: Uint8Array;
  const { size } = statSync(plaintextFilePath);
  let sandbox: Sinon.SinonSandbox;

  before(async () => {
    const encrypted = await encryptAttachmentV2({
      keys,
      plaintext: {
        absolutePath: plaintextFilePath,
      },
      needIncrementalMac: false,
    });
    digest = encrypted.digest;
    iv = encrypted.iv;

    sandbox = Sinon.createSandbox();

    const originalGetPath = window.Signal.Migrations.getAbsoluteAttachmentPath;
    sandbox
      .stub(window.Signal.Migrations, 'getAbsoluteAttachmentPath')
      .callsFake(relPath => {
        if (relPath === plaintextFilePath) {
          return plaintextFilePath;
        }
        return originalGetPath(relPath);
      });
  });

  after(async () => {
    sandbox.restore();
  });

  describe('v1 attachment', () => {
    function composeAttachment(
      overrides?: Partial<AttachmentType>
    ): LocallySavedAttachment {
      return {
        contentType: IMAGE_JPEG,
        size,
        iv: toBase64(iv),
        key: toBase64(keys),
        digest: toBase64(digest),
        path: plaintextFilePath,
        ...overrides,
      };
    }

    it('returns original attachment if reencryptability has already been checked', async () => {
      const attachment = composeAttachment({
        isReencryptableToSameDigest: true,
      });
      const result = await ensureAttachmentIsReencryptable(attachment);
      assert.deepStrictEqual(attachment, result);
    });

    it('marks attachment as reencryptable if it is', async () => {
      const attachment = composeAttachment();
      const result = await ensureAttachmentIsReencryptable(attachment);
      assert.deepStrictEqual(
        { ...attachment, isReencryptableToSameDigest: true },
        result
      );
    });
    it('marks attachment as unreencryptable and generates info if missing info', async () => {
      const attachment = composeAttachment({ iv: undefined });
      const result = await ensureAttachmentIsReencryptable(attachment);
      assert.deepStrictEqual(
        { ...attachment, isReencryptableToSameDigest: false },
        omit(result, 'reencryptionInfo')
      );
      strictAssert(
        result.isReencryptableToSameDigest === false,
        'must be false'
      );
      assert.strictEqual(fromBase64(result.reencryptionInfo.iv).byteLength, 16);
    });
    it('marks attachment as unreencryptable and generates info if encrytion info exists but is wrong', async () => {
      const attachment = composeAttachment({ iv: toBase64(randomBytes(16)) });
      const result = await ensureAttachmentIsReencryptable(attachment);
      assert.deepStrictEqual(
        { ...attachment, isReencryptableToSameDigest: false },
        omit(result, 'reencryptionInfo')
      );
      strictAssert(
        result.isReencryptableToSameDigest === false,
        'must be false'
      );
      assert.strictEqual(fromBase64(result.reencryptionInfo.iv).byteLength, 16);
    });
  });
  describe('v2 attachment', () => {
    let localKey: string;
    let path: string;

    before(async () => {
      const encryptedLocally = await writeNewAttachmentData({
        data: readFileSync(plaintextFilePath),
        getAbsoluteAttachmentPath:
          window.Signal.Migrations.getAbsoluteAttachmentPath,
      });
      localKey = encryptedLocally.localKey;
      path = encryptedLocally.path;
    });

    after(async () => {
      if (path) {
        await safeUnlink(
          window.Signal.Migrations.getAbsoluteAttachmentPath(path)
        );
      }
    });

    function composeAttachment(
      overrides?: Partial<AttachmentType>
    ): LocallySavedAttachment {
      return {
        contentType: IMAGE_JPEG,
        size,
        iv: toBase64(iv),
        key: toBase64(keys),
        digest: toBase64(digest),
        path,
        version: 2,
        localKey,
        ...overrides,
      };
    }

    it('returns original attachment if reencryptability has already been checked', async () => {
      const attachment = composeAttachment({
        isReencryptableToSameDigest: true,
      });
      const result = await ensureAttachmentIsReencryptable(attachment);
      assert.deepStrictEqual(attachment, result);
    });

    it('marks attachment as reencryptable if it is', async () => {
      const attachment = composeAttachment();
      const result = await ensureAttachmentIsReencryptable(attachment);
      assert.deepStrictEqual(
        { ...attachment, isReencryptableToSameDigest: true },
        result
      );
    });
    it('marks attachment as unreencryptable and generates info if missing info', async () => {
      const attachment = composeAttachment({ iv: undefined });
      const result = await ensureAttachmentIsReencryptable(attachment);
      assert.deepStrictEqual(
        { ...attachment, isReencryptableToSameDigest: false },
        omit(result, 'reencryptionInfo')
      );
      strictAssert(
        result.isReencryptableToSameDigest === false,
        'must be false'
      );
      assert.strictEqual(fromBase64(result.reencryptionInfo.iv).byteLength, 16);
    });
    it('marks attachment as unreencryptable and generates info if encrytion info exists but is wrong', async () => {
      const attachment = composeAttachment({ iv: toBase64(randomBytes(16)) });
      const result = await ensureAttachmentIsReencryptable(attachment);
      assert.deepStrictEqual(
        { ...attachment, isReencryptableToSameDigest: false },
        omit(result, 'reencryptionInfo')
      );
      strictAssert(
        result.isReencryptableToSameDigest === false,
        'must be false'
      );
      assert.strictEqual(fromBase64(result.reencryptionInfo.iv).byteLength, 16);
    });
  });
});
