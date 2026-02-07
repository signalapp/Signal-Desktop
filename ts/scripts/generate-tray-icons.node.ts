// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { join } from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { strictAssert } from '../util/assert.std.js';

const cwd = __dirname;
const fontsDir = join(cwd, '..', '..', 'fonts');
const imagesDir = join(cwd, '..', '..', 'images');
const trayIconsDir = join(imagesDir, 'tray-icons');
const trayIconsBaseDir = join(trayIconsDir, 'base');
const trayIconsAlertsDir = join(trayIconsDir, 'alert');
const trayIconsDarkBaseDir = join(trayIconsDir, 'base');
const trayIconsLightBaseDir = join(trayIconsDir, 'base');

enum TrayIconSize {
  Size16 = '16',
  Size32 = '32',
  Size48 = '48',
  Size256 = '256',
}

type TrayIconValue = number | string | null;

type TrayIconImageRequest = Readonly<{
  size: TrayIconSize;
  value: TrayIconValue;
}>;

type TrayIconVariant = {
  size: number;
  maxCount: number;
  badgePadding: number;
  fontSize: number;
  fontWeight: string;
  fontOffsetY: number;
  badgeShadowBlur: number;
  badgeShadowOffsetY: number;
  image: string;
};

GlobalFonts.loadFontsFromDir(fontsDir);

const Inter = GlobalFonts.families.find(family => {
  return family.family === 'Inter';
});

strictAssert(Inter != null, `Failed to load fonts from ${fontsDir}`);

const Constants = {
  fontFamily: 'Inter',
  badgeColor: 'rgb(244, 67, 54)',
  badgeShadowColor: 'rgba(0, 0, 0, 0.25)',
};

const Variants: Record<TrayIconSize, TrayIconVariant> = {
  [TrayIconSize.Size16]: {
    size: 16,
    maxCount: 9,
    badgePadding: 2,
    fontSize: 8,
    fontWeight: '500',
    fontOffsetY: 0,
    badgeShadowBlur: 0,
    badgeShadowOffsetY: 0,
    image: join(trayIconsBaseDir, 'signal-tray-icon-16x16-base.png'),
  },
  [TrayIconSize.Size32]: {
    size: 32,
    maxCount: 9,
    badgePadding: 4,
    fontSize: 12,
    fontWeight: '500',
    fontOffsetY: 0,
    badgeShadowBlur: 1,
    badgeShadowOffsetY: 1,
    image: join(trayIconsBaseDir, 'signal-tray-icon-32x32-base.png'),
  },
  [TrayIconSize.Size48]: {
    size: 48,
    maxCount: 9,
    badgePadding: 6,
    fontSize: 16,
    fontWeight: '500',
    fontOffsetY: -1,
    badgeShadowBlur: 1,
    badgeShadowOffsetY: 1,
    image: join(trayIconsBaseDir, 'signal-tray-icon-48x48-base.png'),
  },
  [TrayIconSize.Size256]: {
    size: 256,
    maxCount: 9,
    fontSize: 72,
    fontWeight: '600',
    fontOffsetY: 0,
    badgePadding: 32,
    badgeShadowBlur: 8,
    badgeShadowOffsetY: 8,
    image: join(trayIconsBaseDir, 'signal-tray-icon-256x256-base.png'),
  },
};

function trayIconValueToText(
  value: TrayIconValue,
  variant: TrayIconVariant
): string {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`Unread count must be positive integer ${value}`);
    }

    if (value === 0) {
      return '';
    }

    if (value > variant.maxCount) {
      return `${variant.maxCount}+`;
    }

    return `${value}`;
  }
  throw new TypeError(`Invalid value ${value}`);
}

const DarkVariants: Record<TrayIconSize, TrayIconVariant> = {
  [TrayIconSize.Size16]: {
    ...Variants[TrayIconSize.Size16],
    image: join(trayIconsDarkBaseDir, 'signal-tray-icon-16x16-dark-base.png'),
  },
  [TrayIconSize.Size32]: {
    ...Variants[TrayIconSize.Size32],
    image: join(trayIconsDarkBaseDir, 'signal-tray-icon-32x32-dark-base.png'),
  },
  [TrayIconSize.Size48]: {
    ...Variants[TrayIconSize.Size48],
    image: join(trayIconsDarkBaseDir, 'signal-tray-icon-48x48-dark-base.png'),
  },
  [TrayIconSize.Size256]: {
    ...Variants[TrayIconSize.Size256],
    image: join(trayIconsDarkBaseDir, 'signal-tray-icon-256x256-dark-base.png'),
  },
};

const LightVariants: Record<TrayIconSize, TrayIconVariant> = {
  [TrayIconSize.Size16]: {
    ...Variants[TrayIconSize.Size16],
    image: join(trayIconsLightBaseDir, 'signal-tray-icon-16x16-light-base.png'),
  },
  [TrayIconSize.Size32]: {
    ...Variants[TrayIconSize.Size32],
    image: join(trayIconsLightBaseDir, 'signal-tray-icon-32x32-light-base.png'),
  },
  [TrayIconSize.Size48]: {
    ...Variants[TrayIconSize.Size48],
    image: join(trayIconsLightBaseDir, 'signal-tray-icon-48x48-light-base.png'),
  },
  [TrayIconSize.Size256]: {
    ...Variants[TrayIconSize.Size256],
    image: join(
      trayIconsLightBaseDir,
      'signal-tray-icon-256x256-light-base.png'
    ),
  },
};

async function generateTrayIconImage(
  request: TrayIconImageRequest,
  variants: Record<TrayIconSize, TrayIconVariant> = Variants
): Promise<Buffer> {
  const variant = variants[request.size];
  if (variant == null) {
    throw new TypeError(`Invalid variant size (${request.size})`);
  }

  const text = trayIconValueToText(request.value, variant);

  const image = await loadImage(variant.image);
  const canvas = createCanvas(variant.size, variant.size);
  const context = canvas.getContext('2d');

  if (context == null) {
    throw new Error('Failed to create 2d canvas context');
  }

  context.imageSmoothingEnabled = false;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, variant.size, variant.size);

  if (text !== '') {
    // Decrements by 1 until the badge fits within the canvas.
    let currentFontSize = variant.fontSize;

    while (currentFontSize > 4) {
      const font = `${variant.fontWeight} ${currentFontSize}px ${Constants.fontFamily}`;

      context.font = font;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.textRendering = 'optimizeLegibility';
      context.fontKerning = 'normal';

      // All font settings should be set before now and should not change.
      const capMetrics = context.measureText('X');
      const textMetrics = context.measureText(text);
      const textWidth = Math.ceil(
        textMetrics.actualBoundingBoxRight + textMetrics.actualBoundingBoxLeft
      );
      const textHeight = Math.ceil(
        capMetrics.actualBoundingBoxAscent + capMetrics.actualBoundingBoxDescent
      );

      const boxHeight = textHeight + variant.badgePadding * 2;
      const boxWidth = Math.max(
        boxHeight, // Ensures the badge is a circle
        textWidth + variant.badgePadding * 2
      );

      // Needed to avoid cutting off the shadow blur
      const boxMargin = variant.badgeShadowBlur;
      const boxWidthWithMargins = boxWidth + boxMargin * 2;

      if (boxWidthWithMargins > variant.size) {
        currentFontSize -= 1;
        continue;
      }

      const boxX = variant.size - boxWidth - boxMargin; // right aligned
      const boxY = boxMargin;
      const boxMidX = boxX + boxWidth / 2;
      const boxMidY = boxY + boxHeight / 2;
      const boxRadius = Math.ceil(boxHeight / 2);

      context.save();
      context.beginPath();
      context.roundRect(boxX, boxY, boxWidth, boxHeight, boxRadius);
      context.fillStyle = Constants.badgeColor;
      if (variant.badgeShadowBlur !== 0 || variant.badgeShadowOffsetY !== 0) {
        context.shadowBlur = variant.badgeShadowBlur;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = variant.badgeShadowOffsetY;
        context.shadowColor = Constants.badgeShadowColor;
      }
      context.fill();
      context.restore();

      context.fillStyle = 'white';
      context.fillText(text, boxMidX, boxMidY + variant.fontOffsetY);

      break;
    }

    if (currentFontSize <= 4) {
      throw new Error(
        `Badge text is too large for canvas size ${variant.size} (${text})`
      );
    }
  }

  return canvas.toBuffer('image/png');
}

function range(start: number, end: number): Array<number> {
  const length = end - start + 1;
  return Array.from({ length }, (_, index) => start + index);
}

async function rmSafe(dir: string) {
  await rm(dir, { recursive: true, force: true });
}

async function generateAlertIcons(
  variants: Record<TrayIconSize, TrayIconVariant>,
  outputDir: string,
  prefix: string
) {
  const requests: Array<TrayIconImageRequest> = [];
  for (const size of Object.values(TrayIconSize)) {
    const variant = variants[size];
    const { maxCount } = variant;
    const values = range(1, maxCount + 1);
    for (const value of values) {
      requests.push({ size, value });
    }
  }

  await mkdir(outputDir, { recursive: true });

  await Promise.all(
    requests.map(async ({ size, value }) => {
      const variant = variants[size];
      const text = trayIconValueToText(value, variant);

      const fileName = `signal-tray-icon-${size}x${size}-${prefix}-${text}.png`;
      const filePath = join(outputDir, fileName);

      const fileContents = await generateTrayIconImage(
        { size, value },
        variants
      );

      console.log(`Writing "${fileName}"`);
      await writeFile(filePath, fileContents);
    })
  );
}

async function main() {
  await rmSafe(trayIconsAlertsDir);

  await generateAlertIcons(Variants, trayIconsAlertsDir, 'alert');
  await generateAlertIcons(DarkVariants, trayIconsAlertsDir, 'dark-alert');
  await generateAlertIcons(LightVariants, trayIconsAlertsDir, 'light-alert');

  console.log('Done');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
