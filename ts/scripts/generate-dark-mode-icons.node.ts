// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createCanvas, loadImage, Image } from '@napi-rs/canvas';

const ICON_SIZES = [16, 32, 128, 256, 512];
const RETINA_MULTIPLIER = 2;

// Color transformation for dark mode
// Original Signal blue: #3A76F0 (RGB: 58, 118, 240)
// Dark mode blue: #2B5278 (RGB: 43, 82, 120) - darker, more muted
const DARK_MODE_BLUE = { r: 43, g: 82, b: 120 };
const LIGHT_MODE_BLUE = { r: 58, g: 118, b: 240 };

interface RGB {
  r: number;
  g: number;
  b: number;
}

function isBlueBackground(r: number, g: number, b: number): boolean {
  // Check if pixel is part of the blue background
  // Signal blue is around RGB(58, 118, 240)
  // We'll consider anything with blue > 200 and blue > red and blue > green as background
  return b > 150 && b > r && b > g;
}

function transformColorToDarkMode(r: number, g: number, b: number, a: number): [number, number, number, number] {
  if (a === 0) {
    return [r, g, b, a];
  }

  // If it's the blue background, transform it to dark mode blue
  if (isBlueBackground(r, g, b)) {
    // Calculate how bright this blue pixel is (0-1)
    const brightness = b / 255;
    
    // Apply the dark mode color with adjusted brightness
    return [
      Math.round(DARK_MODE_BLUE.r * brightness),
      Math.round(DARK_MODE_BLUE.g * brightness),
      Math.round(DARK_MODE_BLUE.b * brightness),
      a
    ];
  }

  // Keep white/light colors (the speech bubble) as is
  return [r, g, b, a];
}

async function createDarkModeVariant(
  inputPath: string,
  outputPath: string,
  size: number
): Promise<void> {
  console.log(`Creating dark mode variant: ${outputPath}`);

  const image = await loadImage(inputPath);
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Draw the original image
  ctx.drawImage(image, 0, 0, size, size);

  // Get image data
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  // Transform colors
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = transformColorToDarkMode(
      data[i],
      data[i + 1],
      data[i + 2],
      data[i + 3]
    );
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }

  // Put the transformed image data back
  ctx.putImageData(imageData, 0, 0);

  // Write to file
  const buffer = canvas.toBuffer('image/png');
  writeFileSync(outputPath, buffer);
}

async function generateIconset(): Promise<void> {
  const rootDir = join(__dirname, '..', '..');
  const pngDir = join(rootDir, 'build', 'icons', 'png');
  const iconsetDir = join(rootDir, 'build', 'icons', 'mac', 'icon.iconset');

  // Create iconset directory
  if (!existsSync(iconsetDir)) {
    mkdirSync(iconsetDir, { recursive: true });
  }

  console.log('Generating macOS iconset with dark mode support...');

  for (const size of ICON_SIZES) {
    const sourcePath = join(pngDir, `${size}x${size}.png`);
    
    if (!existsSync(sourcePath)) {
      console.warn(`Warning: Source file not found: ${sourcePath}`);
      continue;
    }

    // 1x light mode
    const lightPath1x = join(iconsetDir, `icon_${size}x${size}.png`);
    console.log(`Copying light mode 1x: ${lightPath1x}`);
    const lightBuffer = readFileSync(sourcePath);
    writeFileSync(lightPath1x, lightBuffer);

    // 1x dark mode
    const darkPath1x = join(iconsetDir, `icon_${size}x${size}~dark.png`);
    await createDarkModeVariant(sourcePath, darkPath1x, size);

    // 2x variants (retina)
    const size2x = size * RETINA_MULTIPLIER;
    const sourcePath2x = join(pngDir, `${size2x}x${size2x}.png`);
    
    if (existsSync(sourcePath2x)) {
      // 2x light mode
      const lightPath2x = join(iconsetDir, `icon_${size}x${size}@2x.png`);
      console.log(`Copying light mode 2x: ${lightPath2x}`);
      const lightBuffer2x = readFileSync(sourcePath2x);
      writeFileSync(lightPath2x, lightBuffer2x);

      // 2x dark mode
      const darkPath2x = join(iconsetDir, `icon_${size}x${size}@2x~dark.png`);
      await createDarkModeVariant(sourcePath2x, darkPath2x, size2x);
    } else {
      console.warn(`Warning: 2x source file not found: ${sourcePath2x}`);
    }
  }

  console.log('Iconset generation complete!');
  console.log(`Iconset location: ${iconsetDir}`);
}

async function main(): Promise<void> {
  try {
    await generateIconset();
    console.log('\n✓ Dark mode icons generated successfully!');
    console.log('\nNext step: Run the following command to generate icon.icns:');
    console.log('  iconutil -c icns build/icons/mac/icon.iconset -o build/icons/mac/icon.icns');
  } catch (error) {
    console.error('Error generating dark mode icons:', error);
    process.exit(1);
  }
}

main();
