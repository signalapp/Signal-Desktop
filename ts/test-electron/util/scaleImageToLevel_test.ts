// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { IMAGE_JPEG, IMAGE_PNG } from '../../types/MIME';
import * as log from '../../logging/log';

import { scaleImageToLevel } from '../../util/scaleImageToLevel';

describe('scaleImageToLevel', () => {
  // NOTE: These tests are incomplete.

  let objectUrlsToRevoke: Array<string>;
  function createObjectUrl(blob: Blob): string {
    const result = URL.createObjectURL(blob);
    objectUrlsToRevoke.push(result);
    return result;
  }

  beforeEach(() => {
    objectUrlsToRevoke = [];
  });

  afterEach(() => {
    objectUrlsToRevoke.forEach(objectUrl => {
      URL.revokeObjectURL(objectUrl);
    });
  });

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
          const blob = await (await fetch(path)).blob();
          const scaled = await scaleImageToLevel(blob, contentType, true);

          const {
            width,
            height,
          } = await window.Signal.Types.VisualAttachment.getImageDimensions({
            objectUrl: createObjectUrl(scaled.blob),
            logger: log,
          });

          assert.strictEqual(width, expectedWidth);
          assert.strictEqual(height, expectedHeight);
          assert.strictEqual(scaled.contentType, contentType);
          assert.strictEqual(scaled.blob.type, contentType);
        }
      )
    );
  });
});
