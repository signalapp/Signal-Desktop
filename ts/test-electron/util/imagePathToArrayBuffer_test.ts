// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
//
import { assert } from 'chai';
import path from 'path';

import { imagePathToArrayBuffer } from '../../util/imagePathToArrayBuffer';

describe('imagePathToArrayBuffer', () => {
  it('converts an image to an ArrayBuffer', async () => {
    const avatarPath = path.join(
      __dirname,
      '../../../fixtures/kitten-3-64-64.jpg'
    );
    const buffer = await imagePathToArrayBuffer(avatarPath);
    assert.isDefined(buffer);
    assert(buffer instanceof ArrayBuffer);
  });
});
