import { readFileSync, writeFileSync } from 'fs';
import path, { basename } from 'path';
import type { LoadImageResult } from 'blueimp-load-image';
import loadImage from 'blueimp-load-image';
import { assert } from 'chai';
import type { MIMEType } from '../../../types/MIME';
import { IMAGE_JPEG } from '../../../types/MIME';
import type { AnnotatedBlob } from '../support';
import { fileSize } from '../support';
import { canvasToBlob } from '../../../util/canvasToBlob';
import { createTempDir } from '../../../updater/common';

// Based on `getCanvasBlob` (`ts/util/scaleImageToLevel.ts`) which is not exported.
const toBlob = async (
  file: string,
  contentType: MIMEType,
  quality: number = 1
): Promise<AnnotatedBlob> => {
  const data: LoadImageResult = await loadImage(
    new File([Buffer.from(readFileSync(file))], basename(file), {
      type: contentType,
    }),
    {
      canvas: true,
      orientation: true,
      meta: true,
    }
  );

  if (!(data.image instanceof HTMLCanvasElement)) {
    throw new Error('image not a canvas');
  }

  const canvas = data.image as HTMLCanvasElement;

  return {
    blob: await canvasToBlob(data.image, contentType, quality),
    size: { width: canvas.width, height: canvas.height },
    originalSize: { width: data.originalWidth, height: data.originalHeight },
  };
};

describe('[image-processing] File blobs', () => {
  it('is true that <blob.size> matches the size on disk', async () => {
    const fileUnderThreeMB = './fixtures/snow.jpg';
    const { blob } = await toBlob(fileUnderThreeMB, IMAGE_JPEG, 1.0);

    const blobOnDisk = path.join(
      await createTempDir(),
      basename(fileUnderThreeMB)
    );

    writeFileSync(blobOnDisk, new Uint8Array(await blob.arrayBuffer()));

    assert.equal(blob.size, fileSize(blobOnDisk));
  });

  it('is true that <blob.size> is larger than the original file', async () => {
    const fileUnderThreeMB = './fixtures/snow.jpg';
    const { blob } = await toBlob(fileUnderThreeMB, IMAGE_JPEG, 1);

    assert.isAbove(blob.size, fileSize(fileUnderThreeMB));
  });
});
