// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import loadImage from 'blueimp-load-image';
import { IMAGE_JPEG, IMAGE_PNG } from '../../types/MIME';

import { scaleImageToLevel } from '../../util/scaleImageToLevel';

describe('scaleImageToLevel', () => {
  // NOTE: These tests are incomplete.

  async function getBlob(path: string): Promise<Blob> {
    const response = await fetch(path);
    return response.blob();
  }

  it("doesn't scale images that are already small enough", async () => {
    const testCases = [
      {
        path: '../fixtures/kitten-1-64-64.jpg',
        contentType: IMAGE_JPEG,
        expectedWidth: 64,
        expectedHeight: 64,
      },
      {
        path: '../fixtures/20x200-yellow.png',
        contentType: IMAGE_PNG,
        expectedWidth: 20,
        expectedHeight: 200,
      },
    ];

    await Promise.all(
      testCases.map(
        async ({ path, contentType, expectedWidth, expectedHeight }) => {
          const blob = await getBlob(path);
          const scaled = await scaleImageToLevel({
            fileOrBlobOrURL: blob,
            contentType,
            size: blob.size,
            highQuality: true,
          });

          const data = await loadImage(scaled.blob, { orientation: true });
          const { originalWidth: width, originalHeight: height } = data;

          assert.strictEqual(width, expectedWidth);
          assert.strictEqual(height, expectedHeight);
          assert.strictEqual(scaled.contentType, contentType);
          assert.strictEqual(scaled.blob.type, contentType);
        }
      )
    );
  });

  it('removes EXIF data from small images', async () => {
    const original = await getBlob('../fixtures/kitten-2-64-64.jpg');
    assert.isDefined(
      (await loadImage(original, { meta: true, orientation: true })).exif,
      'Test setup failure: expected fixture to have EXIF data'
    );

    const scaled = await scaleImageToLevel({
      fileOrBlobOrURL: original,
      contentType: IMAGE_JPEG,
      size: original.size,
      highQuality: true,
    });
    assert.isUndefined(
      (await loadImage(scaled.blob, { meta: true, orientation: true })).exif
    );
  });
});
