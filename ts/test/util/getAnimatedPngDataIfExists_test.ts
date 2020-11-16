// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as fs from 'fs';
import * as path from 'path';
import { assert } from 'chai';

import { getAnimatedPngDataIfExists } from '../../util/getAnimatedPngDataIfExists';

describe('getAnimatedPngDataIfExists', () => {
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

  it('returns null for empty buffers', () => {
    assert.isNull(getAnimatedPngDataIfExists(Buffer.alloc(0)));
  });

  it('returns null for non-PNG files', async () => {
    await Promise.all(
      [
        'kitten-1-64-64.jpg',
        '512x515-thumbs-up-lincoln.webp',
        'giphy-GVNvOUpeYmI7e.gif',
        'pixabay-Soap-Bubble-7141.mp4',
        'lorem-ipsum.txt',
      ].map(async filename => {
        assert.isNull(getAnimatedPngDataIfExists(await fixture(filename)));
      })
    );
  });

  it('returns null for non-animated PNG files', async () => {
    assert.isNull(
      getAnimatedPngDataIfExists(await fixture('20x200-yellow.png'))
    );
  });

  it('returns data for animated PNG files', async () => {
    assert.deepEqual(
      getAnimatedPngDataIfExists(
        await fixture('Animated_PNG_example_bouncing_beach_ball.png')
      ),
      { numPlays: Infinity }
    );

    assert.deepEqual(
      getAnimatedPngDataIfExists(await fixture('apng_with_2_plays.png')),
      { numPlays: 2 }
    );
  });
});
