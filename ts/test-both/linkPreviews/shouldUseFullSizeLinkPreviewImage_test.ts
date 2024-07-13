// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { VIDEO_MP4 } from '../../types/MIME';

import { fakeAttachment } from '../helpers/fakeAttachment';

import { shouldUseFullSizeLinkPreviewImage } from '../../linkPreviews/shouldUseFullSizeLinkPreviewImage';

describe('shouldUseFullSizeLinkPreviewImage', () => {
  const baseLinkPreview = {
    title: 'Foo Bar',
    domain: 'example.com',
    url: 'https://example.com/foo.html',
    isStickerPack: false,
    isCallLink: false,
  };

  it('returns false if there is no image', () => {
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
      })
    );
  });

  it('returns false is the preview is a sticker pack', () => {
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        isStickerPack: true,
        image: fakeAttachment(),
      })
    );
  });

  it("returns false if either of the image's dimensions are missing", () => {
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: undefined }),
      })
    );
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ height: undefined }),
      })
    );
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: undefined, height: undefined }),
      })
    );
  });

  it("returns false if either of the image's dimensions are <200px", () => {
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: 199 }),
      })
    );
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ height: 199 }),
      })
    );
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: 150, height: 199 }),
      })
    );
  });

  it('returns false if the image is square', () => {
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: 200, height: 200 }),
      })
    );
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: 500, height: 500 }),
      })
    );
  });

  it('returns false if the image is roughly square', () => {
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: 200, height: 201 }),
      })
    );
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: 497, height: 501 }),
      })
    );
  });

  it("returns false for large attachments that aren't images", () => {
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({
          contentType: VIDEO_MP4,
          fileName: 'foo.mp4',
          url: '/tmp/foo.mp4',
        }),
      })
    );
  });

  it('returns true for larger images', () => {
    assert.isTrue(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: 200, height: 500 }),
      })
    );
    assert.isTrue(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment(),
      })
    );
  });
});
