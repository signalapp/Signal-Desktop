// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AvatarColorType } from '../types/Colors';
import { AvatarColorMap } from '../types/Colors';
import type { AvatarDataType } from '../types/Avatar';
import { canvasToBytes } from './canvasToBytes';
import { getFittedFontSize } from './avatarTextSizeCalculator';
import {
  getLocalAttachmentUrl,
  AttachmentDisposition,
} from './getLocalAttachmentUrl';

const CANVAS_SIZE = 1024;

function getAvatarColor(color: AvatarColorType): { bg: string; fg: string } {
  return AvatarColorMap.get(color) || { bg: 'black', fg: 'white' };
}

function setCanvasBackground(
  bg: string,
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement
): void {
  context.fillStyle = bg;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

async function drawImage(
  src: string,
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement
): Promise<void> {
  const image = new Image();
  image.src = src;
  await image.decode();
  // eslint-disable-next-line no-param-reassign
  canvas.width = image.width;
  // eslint-disable-next-line no-param-reassign
  canvas.height = image.height;
  context.drawImage(image, 0, 0);
}

async function getFont(text: string): Promise<string> {
  const font = new window.FontFace(
    'Inter',
    'url("fonts/inter-v3.19/Inter-Regular.woff2")'
  );
  await font.load();

  const measurerCanvas = document.createElement('canvas');
  measurerCanvas.width = CANVAS_SIZE;
  measurerCanvas.height = CANVAS_SIZE;

  const measurerContext = measurerCanvas.getContext('2d');
  if (!measurerContext) {
    throw new Error('getFont: could not get canvas rendering context');
  }

  const fontSize = getFittedFontSize(CANVAS_SIZE, text, candidateFontSize => {
    const candidateFont = `${candidateFontSize}px Inter`;
    measurerContext.font = candidateFont;

    const {
      actualBoundingBoxLeft,
      actualBoundingBoxRight,
      actualBoundingBoxAscent,
      actualBoundingBoxDescent,
    } = measurerContext.measureText(text);

    const width =
      Math.abs(actualBoundingBoxLeft) + Math.abs(actualBoundingBoxRight);
    const height =
      Math.abs(actualBoundingBoxAscent) + Math.abs(actualBoundingBoxDescent);

    return { height, width };
  });

  return `${fontSize}px Inter`;
}

export async function avatarDataToBytes(
  avatarData: AvatarDataType
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error(
      'avatarDataToBytes: could not get canvas rendering context'
    );
  }

  const { color, icon, imagePath, text } = avatarData;

  if (imagePath) {
    await drawImage(
      getLocalAttachmentUrl(
        {
          ...avatarData,

          // Slight incompatibility
          path: imagePath,
        },
        {
          disposition: AttachmentDisposition.AvatarData,
        }
      ),
      context,
      canvas
    );
  } else if (color && text) {
    const { bg, fg } = getAvatarColor(color);

    setCanvasBackground(bg, context, canvas);
    context.fillStyle = fg;
    const font = await getFont(text);
    context.font = font;
    context.textBaseline = 'middle';
    context.textAlign = 'center';
    context.fillText(text, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 30);
  } else if (color && icon) {
    const iconPath = `images/avatars/avatar_${icon}.svg`;
    await drawImage(iconPath, context, canvas);
    context.globalCompositeOperation = 'destination-over';
    const { bg } = getAvatarColor(color);
    setCanvasBackground(bg, context, canvas);
  }

  return canvasToBytes(canvas);
}
