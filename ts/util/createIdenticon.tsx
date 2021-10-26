// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import loadImage from 'blueimp-load-image';
import { renderToString } from 'react-dom/server';
import type { AvatarColorType } from '../types/Colors';
import { AvatarColorMap } from '../types/Colors';
import { IdenticonSVG } from '../components/IdenticonSVG';

export function createIdenticon(
  color: AvatarColorType,
  content: string
): Promise<string> {
  const [defaultColorValue] = Array.from(AvatarColorMap.values());
  const avatarColor = AvatarColorMap.get(color);
  const html = renderToString(
    <IdenticonSVG
      backgroundColor={avatarColor?.bg || defaultColorValue.bg}
      content={content}
      foregroundColor={avatarColor?.fg || defaultColorValue.fg}
    />
  );
  const svg = new Blob([html], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svg);

  return new Promise(resolve => {
    const img = document.createElement('img');
    img.onload = () => {
      const canvas = loadImage.scale(img, {
        canvas: true,
        maxWidth: 100,
        maxHeight: 100,
      });
      if (!(canvas instanceof HTMLCanvasElement)) {
        resolve('');
        return;
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
      }
      URL.revokeObjectURL(svgUrl);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      resolve('');
    };

    img.src = svgUrl;
  });
}
