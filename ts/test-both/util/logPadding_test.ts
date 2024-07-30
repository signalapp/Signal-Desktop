// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Readable } from 'stream';

import { logPadSize, appendPaddingStream } from '../../util/logPadding';

const BUCKET_SIZES = [
  541, 568, 596, 626, 657, 690, 725, 761, 799, 839, 881, 925, 972, 1020, 1071,
  1125, 1181, 1240, 1302, 1367, 1436, 1507, 1583, 1662, 1745, 1832, 1924, 2020,
  2121, 2227, 2339, 2456, 2579, 2708, 2843, 2985, 3134, 3291, 3456, 3629, 3810,
  4001, 4201, 4411, 4631, 4863, 5106, 5361, 5629, 5911, 6207, 6517, 6843, 7185,
  7544, 7921, 8318, 8733, 9170, 9629, 10110, 10616, 11146, 11704, 12289, 12903,
  13549, 14226, 14937, 15684, 16469, 17292, 18157, 19065, 20018, 21019, 22070,
  23173, 24332, 25549, 26826, 28167, 29576, 31054, 32607, 34238, 35950, 37747,
  39634, 41616, 43697, 45882, 48176, 50585, 53114, 55770, 58558, 61486, 64561,
  67789, 71178, 74737, 78474, 82398, 86518, 90843, 95386, 100155, 105163,
  110421, 115942, 121739, 127826, 134217, 140928, 147975, 155373, 163142,
  171299, 179864, 188858, 198300, 208215, 218626, 229558, 241036, 253087,
  265742, 279029, 292980, 307629, 323011, 339161, 356119, 373925, 392622,
  412253, 432866, 454509, 477234, 501096, 526151, 552458, 580081, 609086,
  639540, 671517, 705093, 740347, 777365, 816233, 857045, 899897, 944892,
  992136, 1041743, 1093831, 1148522, 1205948, 1266246, 1329558, 1396036,
  1465838, 1539130, 1616086, 1696890, 1781735, 1870822, 1964363, 2062581,
  2165710, 2273996, 2387695, 2507080, 2632434, 2764056, 2902259, 3047372,
  3199740, 3359727, 3527714, 3704100, 3889305, 4083770, 4287958, 4502356,
  4727474, 4963848, 5212040, 5472642, 5746274, 6033588, 6335268, 6652031,
  6984633, 7333864, 7700558, 8085585, 8489865, 8914358, 9360076, 9828080,
  10319484, 10835458, 11377231, 11946092, 12543397, 13170567, 13829095,
  14520550, 15246578, 16008907, 16809352, 17649820, 18532311, 19458926,
  20431872, 21453466, 22526139, 23652446, 24835069, 26076822, 27380663,
  28749697, 30187181, 31696540, 33281368, 34945436, 36692708, 38527343,
  40453710, 42476396, 44600216, 46830227, 49171738, 51630325, 54211841,
  56922433, 59768555, 62756983, 65894832, 69189573, 72649052, 76281505,
  80095580, 84100359, 88305377, 92720646, 97356678, 102224512, 107335738,
];

describe('logPadSize', () => {
  it('properly calculates first bucket', () => {
    for (let size = 0, max = BUCKET_SIZES[0]; size < max; size += 1) {
      assert.strictEqual(BUCKET_SIZES[0], logPadSize(size));
    }
  });

  it('properly calculates entire table', () => {
    let count = 0;

    const failures = new Array<string>();
    for (let i = 0, max = BUCKET_SIZES.length - 1; i < max; i += 1) {
      // Exact
      if (BUCKET_SIZES[i] !== logPadSize(BUCKET_SIZES[i])) {
        count += 1;
        failures.push(
          `${BUCKET_SIZES[i]} does not equal ${logPadSize(BUCKET_SIZES[i])}`
        );
      }

      // Just under
      if (BUCKET_SIZES[i] !== logPadSize(BUCKET_SIZES[i] - 1)) {
        count += 1;
        failures.push(
          `${BUCKET_SIZES[i]} does not equal ${logPadSize(BUCKET_SIZES[i] - 1)}`
        );
      }

      // Just over
      if (BUCKET_SIZES[i + 1] !== logPadSize(BUCKET_SIZES[i] + 1)) {
        count += 1;
        failures.push(
          `${BUCKET_SIZES[i + 1]} does not equal ` +
            `${logPadSize(BUCKET_SIZES[i] + 1)}`
        );
      }
    }

    assert.strictEqual(count, 0, failures.join('\n'));
  });
});

describe('appendPaddingStream', () => {
  async function check(
    inputs: ReadonlyArray<string>,
    expectedSize: number
  ): Promise<void> {
    const stream = appendPaddingStream();

    Readable.from(inputs).pipe(stream);

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const buf = Buffer.concat(chunks);

    // Determine padding length
    let padding = 0;
    for (; padding < buf.length; padding += 1) {
      if (buf[buf.length - padding - 1] !== 0) {
        break;
      }
    }

    assert.strictEqual(buf.slice(0, -padding).toString(), inputs.join(''));
    assert.strictEqual(buf.length, expectedSize);
  }

  it('should append padding to a short input', async () => {
    await check(['hello'], BUCKET_SIZES[0]);
  });

  it('should append padding to a longer input', async () => {
    await check('test.'.repeat(1024).split('.'), BUCKET_SIZES[42]);
  });

  it('should append padding to a very long input', async () => {
    await check(
      `${'a'.repeat(64 * 1024)}.`.repeat(1024).split('.'),
      BUCKET_SIZES[241]
    );
  });
});
