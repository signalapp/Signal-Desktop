// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as fs from 'node:fs';
import * as path from 'node:path';
import { assert } from 'chai';
import {
  IMAGE_BMP,
  IMAGE_GIF,
  IMAGE_ICO,
  IMAGE_JPEG,
  IMAGE_PNG,
  IMAGE_WEBP,
} from '../../types/MIME.std.js';

import { sniffImageMimeType } from '../../util/sniffImageMimeType.std.js';

describe('sniffImageMimeType', () => {
  const fixture = (filename: string): Promise<Buffer> => {
    const fixturePath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'fixtures',
      filename
    );
    return fs.promises.readFile(fixturePath);
  };

  it('returns undefined for empty buffers', () => {
    assert.isUndefined(sniffImageMimeType(new Uint8Array()));
  });

  it('returns undefined for non-image files', async () => {
    await Promise.all(
      ['pixabay-Soap-Bubble-7141.mp4', 'lorem-ipsum.txt'].map(
        async filename => {
          assert.isUndefined(sniffImageMimeType(await fixture(filename)));
        }
      )
    );
  });

  it('sniffs ICO files', async () => {
    assert.strictEqual(
      sniffImageMimeType(await fixture('kitten-1-64-64.ico')),
      IMAGE_ICO
    );
  });

  it('sniffs BMP files', async () => {
    assert.strictEqual(sniffImageMimeType(await fixture('2x2.bmp')), IMAGE_BMP);
  });

  it('sniffs GIF files', async () => {
    assert.strictEqual(
      sniffImageMimeType(await fixture('giphy-GVNvOUpeYmI7e.gif')),
      IMAGE_GIF
    );
  });

  it('sniffs WEBP files', async () => {
    assert.strictEqual(
      sniffImageMimeType(await fixture('512x515-thumbs-up-lincoln.webp')),
      IMAGE_WEBP
    );
  });

  it('sniffs PNG files', async () => {
    await Promise.all(
      [
        'freepngs-2cd43b_bed7d1327e88454487397574d87b64dc_mv2.png',
        'Animated_PNG_example_bouncing_beach_ball.png',
      ].map(async filename => {
        assert.strictEqual(
          sniffImageMimeType(await fixture(filename)),
          IMAGE_PNG
        );
      })
    );
  });

  it('sniffs JPEG files', async () => {
    assert.strictEqual(
      sniffImageMimeType(await fixture('kitten-1-64-64.jpg')),
      IMAGE_JPEG
    );
  });
});
