// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo } from 'react';
import QR from 'qrcode-generator';

export type PropsType = Readonly<{
  size: number;
  link: string;
  color: string;
}>;

const LOGO_PATH =
  'M16.904 32.723V35a17.034 17.034 0 0 1-5.594-1.334l.595-2.22a14.763 14' +
  '.763 0 0 0 5 1.277ZM9.119 33.064l.667-2.49-5.707 1.338 1.18-5.034-2.3' +
  '82.209-1.22 5.204A1.7 1.7 0 0 0 3.7 34.334l5.419-1.27ZM3.28 19.159c.1' +
  '5 1.91.671 3.77 1.53 5.477l-2.41.21a17.037 17.037 0 0 1-1.397-5.688H3' +
  '.28ZM3.277 16.885H1c.146-2.223.727-4.4 1.712-6.403l1.972 1.139a14.765' +
  ' 14.765 0 0 0-1.407 5.264ZM5.821 9.652 3.85 8.513a17.035 17.035 0 0 1' +
  ' 4.69-4.68l1.138 1.972a14.763 14.763 0 0 0-3.856 3.847ZM11.648 4.672l' +
  '-1.139-1.973c2-.978 4.172-1.556 6.395-1.699v2.277a14.762 14.762 0 0 0' +
  '-5.256 1.395ZM19.177 3.283c1.816.145 3.593.625 5.24 1.42l1.137-1.973a' +
  '17.034 17.034 0 0 0-6.377-1.725v2.278ZM29.795 9.118c.14.186.276.376.4' +
  '07.568l1.971-1.139a17.035 17.035 0 0 0-4.654-4.675l-1.138 1.973a14.76' +
  '3 14.763 0 0 1 3.414 3.273ZM32.52 15.322c.096.518.163 1.04.203 1.563H' +
  '35a17.048 17.048 0 0 0-1.694-6.367l-1.973 1.14c.552 1.16.952 2.391 1.' +
  '187 3.664ZM32.188 22.09a14.759 14.759 0 0 1-.871 2.287l1.972 1.139a17' +
  '.032 17.032 0 0 0 1.708-6.357H32.72a14.768 14.768 0 0 1-.532 2.93ZM28' +
  '.867 27.995a14.757 14.757 0 0 1-2.504 2.173l1.139 1.973a17.028 17.028' +
  ' 0 0 0 4.65-4.657l-1.972-1.139c-.396.58-.835 1.13-1.313 1.65ZM23.259 ' +
  '31.797c-1.314.5-2.69.809-4.082.92v2.278a17.033 17.033 0 0 0 6.358-1.7' +
  '16l-1.139-1.972c-.371.179-.75.342-1.137.49Z M11.66 7.265a12.463 12.46' +
  '3 0 0 1 11.9-.423 12.466 12.466 0 0 1 6.42 14.612 12.47 12.47 0 0 1-1' +
  '3.21 8.954 12.462 12.462 0 0 1-5.411-1.857L6.246 29.75l1.199-5.115a12' +
  '.47 12.47 0 0 1 4.216-17.37Z';

const AUTODETECT_TYPE_NUMBER = 0;
const ERROR_CORRECTION_LEVEL = 'H';
const CENTER_CUTAWAY_PERCENTAGE = 30 / 184;
const CENTER_LOGO_PERCENTAGE = 38 / 184;
const QR_NATIVE_SIZE = 36;

type ComputeResultType = Readonly<{
  path: string;
  moduleCount: number;
  radius: number;
}>;

function compute(link: string): ComputeResultType {
  const qr = QR(AUTODETECT_TYPE_NUMBER, ERROR_CORRECTION_LEVEL);
  qr.addData(link);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const center = moduleCount / 2;
  const radius = CENTER_CUTAWAY_PERCENTAGE * moduleCount;

  function hasPixel(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= moduleCount || y >= moduleCount) {
      return false;
    }

    const distanceFromCenter = Math.sqrt(
      (x - center + 0.5) ** 2 + (y - center + 0.5) ** 2
    );

    // Center and 1 dot away should remain clear for the logo placement.
    if (Math.ceil(distanceFromCenter) <= radius + 3) {
      return false;
    }

    return qr.isDark(x, y);
  }

  const path = [];
  for (let y = 0; y < moduleCount; y += 1) {
    for (let x = 0; x < moduleCount; x += 1) {
      if (!hasPixel(x, y)) {
        continue;
      }

      const onTop = hasPixel(x, y - 1);
      const onBottom = hasPixel(x, y + 1);
      const onLeft = hasPixel(x - 1, y);
      const onRight = hasPixel(x + 1, y);

      const roundTL = !onLeft && !onTop;
      const roundTR = !onTop && !onRight;
      const roundBR = !onRight && !onBottom;
      const roundBL = !onBottom && !onLeft;

      path.push(
        `M${2 * x} ${2 * y + 1}`,
        roundTL ? 'a1 1 0 0 1 1 -1' : 'v-1h1',
        roundTR ? 'a1 1 0 0 1 1 1' : 'h1v1',
        roundBR ? 'a1 1 0 0 1 -1 1' : 'v1h-1',
        roundBL ? 'a1 1 0 0 1 -1 -1' : 'h-1v-1',
        'z'
      );
    }
  }

  return {
    path: path.join(''),
    moduleCount,
    radius,
  };
}

export function BrandedQRCode({ size, link, color }: PropsType): JSX.Element {
  const { path, moduleCount, radius } = useMemo(() => compute(link), [link]);

  const QR_SCALE = size / 2 / moduleCount;

  const CENTER_X = size / 2;
  const CENTER_Y = size / 2;
  const LOGO_SIZE = CENTER_LOGO_PERCENTAGE * size;
  const LOGO_X = CENTER_X - LOGO_SIZE / 2;
  const LOGO_Y = CENTER_Y - LOGO_SIZE / 2;
  const LOGO_SCALE = LOGO_SIZE / QR_NATIVE_SIZE;

  return (
    <>
      <g transform={`scale(${QR_SCALE} ${QR_SCALE})`}>
        <path d={path} fill={color} />

        <circle
          cx={moduleCount}
          cy={moduleCount}
          r={radius * 2}
          stroke={color}
          strokeWidth={2}
        />
      </g>

      <g
        transform={`translate(${LOGO_X} ${LOGO_Y}) scale(${LOGO_SCALE} ${LOGO_SCALE})`}
      >
        <path fill={color} d={LOGO_PATH} />
      </g>
    </>
  );
}
