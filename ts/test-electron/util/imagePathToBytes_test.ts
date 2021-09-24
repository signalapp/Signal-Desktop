// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
//
import { assert } from 'chai';
import path from 'path';

import { imagePathToBytes } from '../../util/imagePathToBytes';

describe('imagePathToBytes', () => {
  it('converts an image to an Bytes', async () => {
    const avatarPath = path.join(
      __dirname,
      '../../../fixtures/kitten-3-64-64.jpg'
    );
    const buffer = await imagePathToBytes(avatarPath);
    assert.isDefined(buffer);
    assert(buffer instanceof Uint8Array);
  });
});
