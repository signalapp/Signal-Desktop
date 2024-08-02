// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import loadImage from 'blueimp-load-image';
import { renderToString } from 'react-dom/server';
import type { AvatarColorType } from '../types/Colors';
import { AvatarColorMap } from '../types/Colors';
import {
  IdenticonSVGForCallLink,
  IdenticonSVGForContact,
  IdenticonSVGForGroup,
} from '../components/IdenticonSVG';
import { missingCaseError } from './missingCaseError';

const TARGET_MIME = 'image/png';

type IdenticonDetailsType =
  | {
      type: 'contact';
      text: string;
    }
  | {
      type: 'group';
    }
  | {
      type: 'call-link';
    };

export function createIdenticon(
  color: AvatarColorType,
  details: IdenticonDetailsType,
  { saveToDisk }: { saveToDisk?: boolean } = {}
): Promise<{ url: string; path?: string }> {
  const [defaultColorValue] = Array.from(AvatarColorMap.values());
  const avatarColor = AvatarColorMap.get(color);
  let html: string;

  if (details.type === 'contact') {
    html = renderToString(
      <IdenticonSVGForContact
        backgroundColor={avatarColor?.bg || defaultColorValue.bg}
        text={details.text}
        foregroundColor={avatarColor?.fg || defaultColorValue.fg}
      />
    );
  } else if (details.type === 'group') {
    html = renderToString(
      <IdenticonSVGForGroup
        backgroundColor={avatarColor?.bg || defaultColorValue.bg}
        foregroundColor={avatarColor?.fg || defaultColorValue.fg}
      />
    );
  } else if (details.type === 'call-link') {
    html = renderToString(
      <IdenticonSVGForCallLink
        backgroundColor={avatarColor?.bg || defaultColorValue.bg}
        foregroundColor={avatarColor?.fg || defaultColorValue.fg}
      />
    );
  } else {
    throw missingCaseError(details);
  }

  const svg = new Blob([html], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svg);

  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.onload = () => {
      const canvas = loadImage.scale(img, {
        canvas: true,
        maxWidth: 100,
        maxHeight: 100,
      });
      if (!(canvas instanceof HTMLCanvasElement)) {
        reject(
          new Error(
            'createIdenticon: canvas was not an instance of HTMLCanvasElement'
          )
        );
        return;
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
      }
      URL.revokeObjectURL(svgUrl);

      const url = canvas.toDataURL(TARGET_MIME);

      if (!saveToDisk) {
        resolve({ url });
      }

      canvas.toBlob(blob => {
        if (!blob) {
          reject(
            new Error(
              'createIdenticon: no blob data provided in toBlob callback'
            )
          );
          return;
        }

        const reader = new FileReader();
        reader.addEventListener('loadend', async () => {
          const arrayBuffer = reader.result;
          if (!arrayBuffer || typeof arrayBuffer === 'string') {
            reject(
              new Error(
                'createIdenticon: no data in reader.result in FileReader loadend event'
              )
            );
            return;
          }

          const data = new Uint8Array(arrayBuffer);
          const path =
            await window.Signal.Migrations.writeNewPlaintextTempData(data);
          resolve({ url, path });
        });
        reader.readAsArrayBuffer(blob);
      }, TARGET_MIME);
    };

    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      reject(new Error('createIdenticon: Unable to create img element'));
    };

    img.src = svgUrl;
  });
}
