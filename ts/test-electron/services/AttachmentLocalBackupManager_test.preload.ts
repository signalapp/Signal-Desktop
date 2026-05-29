// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { getExtension } from '../../jobs/AttachmentLocalBackupManager.preload.ts';
import { IMAGE_JPEG } from '../../types/MIME.std.ts';

describe('AttachmentLocalBackupManager', () => {
  describe('getExtension', () => {
    it('prefers valid filename extensions', () => {
      assert.strictEqual(getExtension(IMAGE_JPEG, 'attachment.png'), 'png');
      assert.strictEqual(getExtension(undefined, 'archive.tar.gz'), 'gz');
      assert.strictEqual(getExtension(undefined, 'source.c'), 'c');
      assert.strictEqual(getExtension(undefined, 'image.svg+xml'), 'svg+xml');
    });

    it('falls back to content type when the filename extension is invalid', () => {
      assert.strictEqual(getExtension(IMAGE_JPEG, 'attachment.*'), 'jpeg');
      assert.strictEqual(getExtension(IMAGE_JPEG, 'attachment._png'), 'jpeg');
      assert.strictEqual(getExtension(IMAGE_JPEG, 'attachment.png_'), 'jpeg');
      assert.strictEqual(getExtension(IMAGE_JPEG, 'attachment.+png'), 'jpeg');
      assert.strictEqual(getExtension(IMAGE_JPEG, 'attachment.png+'), 'jpeg');
      assert.strictEqual(getExtension(IMAGE_JPEG, 'attachment.png-'), 'jpeg');
      assert.strictEqual(
        getExtension('application/vnd.ms-excel', 'attachment.'),
        'vnd.ms-excel'
      );
    });

    it('ignores invalid content type extensions', () => {
      assert.strictEqual(
        getExtension('application/*', 'attachment.*'),
        undefined
      );
      assert.strictEqual(getExtension('image/jpeg.', undefined), undefined);
    });

    it('uses txt for signal plain text attachments', () => {
      assert.strictEqual(getExtension('text/x-signal-plain', undefined), 'txt');
    });
  });
});
