/* eslint-disable max-len */
import { readFileSync } from 'fs';
import { basename } from 'path';
import { assert } from 'chai';
import { handleImageAttachment } from '../../util/handleImageAttachment';
import { downscaleOutgoingAttachment } from '../../util/attachments';
import type { FileInfo, Result } from './support';
import {
  fileSize,
  jpegDimensions,
  MiB,
  pngDimensions,
  sha256,
} from './support';

// Using a more realistic code path than just `handleImageAttachment` to match what users see.
//
// See: ts/models/conversations.ts
// /**
//      * At this point, all attachments have been processed and written to disk as draft
//      * attachments, via processAttachments. All transcodable images have been re-encoded
//      * via canvas to remove EXIF data. Images above the high-quality threshold size have
//      * been scaled to high-quality JPEGs.
//      *
//      * If we choose to send images in standard quality, we need to scale them down
//      * (potentially for the second time). When we do so, we also delete the current
//      * draft attachment on disk for cleanup.
//      *
//      * All draft attachments (with a path or just in-memory) will be written to disk for
//      * real in `upgradeMessageSchema`.
//      */
// if (!sendHQImages) {
//   attachmentsToSend = await Promise.all(
//     attachmentsToSend.map(async attachment => {
//       const downscaledAttachment = await downscaleOutgoingAttachment(
//         attachment
//       );
//       if (downscaledAttachment !== attachment && attachment.path) {
//         drop(deleteAttachmentData(attachment.path));
//       }
//       return downscaledAttachment;
//     })
//   );
// }
//
const downscaleJpeg = async (
  filePath: string
): Promise<[FileInfo, FileInfo]> => {
  const result = (await handleImageAttachment(
    new File([readFileSync(filePath)], basename(filePath), {
      type: 'image/jpeg',
    })
  )) as Result;

  const downscaled: Buffer = Buffer.from(
    (await downscaleOutgoingAttachment(result)).data || new Uint8Array(0)
  );

  return [
    {
      path: filePath,
      dimensions: await jpegDimensions(readFileSync(filePath)),
      size: downscaled.length,
      buffer: downscaled,
    },
    {
      path: '',
      dimensions: await jpegDimensions(downscaled),
      size: downscaled.length,
      buffer: downscaled,
    },
  ];
};

const downscalePng = async (
  filePath: string
): Promise<[FileInfo, FileInfo]> => {
  const result = (await handleImageAttachment(
    new File([readFileSync(filePath)], basename(filePath), {
      type: 'image/png',
    })
  )) as Result;

  const downscaled: Buffer = Buffer.from(
    (await downscaleOutgoingAttachment(result)).data || new Uint8Array(0)
  );

  return [
    {
      path: filePath,
      dimensions: pngDimensions(readFileSync(filePath)),
      size: downscaled.length,
      buffer: downscaled,
    },
    {
      path: '',
      dimensions: pngDimensions(downscaled),
      size: downscaled.length,
      buffer: downscaled,
    },
  ];
};

describe('[image-processing] Handling uploaded images', () => {
  /*
  
    I know by experiment that uploading './fixtures/snow.jpg' produces a file with smaller dimensions and file size.

      900x1600 and 131,031 B 

    This shows how to replicate this behaviour exactly.

    @todo: does this depend on quality settings, i.e. whether or not `sendHQImages` is true.?

  */
  it('produces a smaller file size and dimensions', async () => {
    const originalFile = './fixtures/snow.jpg';

    assert.equal(
      sha256(originalFile),
      '59f324cee597413d4f905f62c3a09a5b31c25f550d3253706c5af0d18fe04f10'
    );

    const [original, downscaled] = await downscaleJpeg(originalFile);

    assert.equal(fileSize(originalFile), 248_357);
    assert.equal(downscaled.size, 131_031);

    assert.deepEqual(original.dimensions, { width: 1152, height: 2048 });
    assert.deepEqual(downscaled.dimensions, { width: 900, height: 1600 });
  });

  it('returns a png file when input file is smaller than "MediaQualityLevels.Three" threshold size (400kB)', async () => {
    const smallPngFile = './fixtures/20x200-yellow.png';

    assert.isBelow(fileSize(smallPngFile), 0.4 * MiB);

    const [original, downscaled] = await downscaleJpeg(smallPngFile);

    assert.deepEqual(downscaled.dimensions, original.dimensions);
    assert.deepEqual(downscaled.size, original.size);
  });

  /*
  
    https://github.com/signalapp/Signal-Desktop/issues/6928 "Transparent Png Doesn't Work (Even With Files)"

    Show specifically that the above issue has been resolved.

  */
  it('returns a png file when input file is larger than "MediaQualityLevels.Three" threshold size (400kB)', async () => {
    const largePngFile =
      './fixtures/freepngs-2cd43b_bed7d1327e88454487397574d87b64dc_mv2.png';

    assert.isAbove(fileSize(largePngFile), 0.4 * MiB);

    const [before, after] = await downscalePng(largePngFile);

    assert.deepEqual(before.dimensions, after.dimensions);

    assert.equal(before.size, after.size, 'Expected size to remain the same');
  });

  /*
  
    https://github.com/signalapp/Signal-Desktop/issues/6881 "File size increase when sending images"

  */
  it('increases file size in some cases (while keeping the same dimensions)', async () => {
    const originalFile = './fixtures/github-issue-6881-sample.jpg';

    assert.equal(
      sha256(originalFile),
      '3000ddc8d560fb26e490bc725b6af4d27c46c56e9ea96142be9d2df3b5cf4e72'
    );

    assert.equal(fileSize(originalFile), 35_368);

    const [original, downscaled] = await downscaleJpeg(originalFile);

    assert.equal(downscaled.size, 80_391);

    assert.deepEqual(original.dimensions, { width: 928, height: 640 });
    assert.deepEqual(downscaled.dimensions, { width: 928, height: 640 });
  });
});
