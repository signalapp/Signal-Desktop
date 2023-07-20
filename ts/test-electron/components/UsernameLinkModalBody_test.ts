// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import path from 'path';
import { mkdir } from 'fs/promises';
import { pathExists, writeFile, readFile } from 'fs-extra';

import {
  _generateImageBlob,
  COLOR_MAP,
} from '../../components/UsernameLinkModalBody';
import { SignalService as Proto } from '../../protobuf';

const ColorEnum = Proto.AccountRecord.UsernameLink.Color;

async function getImageData(blob: Blob): Promise<ImageData> {
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    await new Promise(resolve => {
      img.addEventListener('load', resolve);
      img.src = url;
    });

    const canvas = new OffscreenCanvas(img.width, img.height);

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2d context');
    }

    context.drawImage(img, 0, 0);
    return context.getImageData(0, 0, img.width, img.height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const TEST_COLORS: ReadonlyArray<[string, number]> = [
  ['white', ColorEnum.WHITE],
  ['blue', ColorEnum.BLUE],
];

describe('<UsernameLinkModalBody>', () => {
  before(async () => {
    // We need to load the font first, otherwise the first test render will use
    // default font (not Inter)
    const f = new FontFace(
      'Inter',
      'url(../fonts/inter-v3.19/Inter-SemiBold.woff2)',
      {
        weight: '600',
      }
    );

    await f.load();

    document.fonts.add(f);
  });

  for (const [colorName, colorId] of TEST_COLORS) {
    it(`should generate correct ${colorName} QR code image`, async () => {
      const scheme = COLOR_MAP.get(colorId);
      if (!scheme) {
        throw new Error(`Missing color scheme for: ${colorId}`);
      }

      const { bg: bgColor, fg: fgColor } = scheme;

      const generatedBlob = await _generateImageBlob({
        link:
          'https://signal.me#eu/' +
          'E7wk7FTMz_UYjLAsswHpDsGku8CW7yTmlBh8gtd4yqjQlqcbh09F25x0aQT4_Efe',
        username: 'signal.12',
        colorId,
        bgColor,
        fgColor,

        // Just because we run from `test/` folder, and not `/`
        logoUrl: '../images/signal-qr-logo.svg',

        // Force pixel ratio since test runner might not be on Retina
        devicePixelRatio: 2,
      });

      // Create fixture if not present
      const fileName = `username-link-${colorName}-${process.platform}.png`;
      const fixture = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'fixtures',
        fileName
      );
      if (!(await pathExists(fixture))) {
        await writeFile(
          fixture,
          Buffer.from(await generatedBlob.arrayBuffer())
        );
        return;
      }

      // Otherwise compare against existing fixture
      const expectedData = new Blob([await readFile(fixture)], {
        type: 'image/png',
      });

      const expected = await getImageData(expectedData);
      const actual = await getImageData(generatedBlob);

      try {
        assert.strictEqual(actual.width, expected.width, 'Wrong image width');
        assert.strictEqual(
          actual.height,
          expected.height,
          'Wrong image height'
        );
        assert.deepEqual(actual.data, expected.data, 'Wrong image data');
      } catch (error) {
        const { ARTIFACTS_DIR } = process.env;
        if (ARTIFACTS_DIR) {
          await mkdir(ARTIFACTS_DIR, { recursive: true });
          await writeFile(
            path.join(ARTIFACTS_DIR, fileName),
            Buffer.from(await generatedBlob.arrayBuffer())
          );
        }

        throw error;
      }
    });
  }
});
