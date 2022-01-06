// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React, { useEffect, useMemo, useRef } from 'react';
import qrcode from 'qrcode-generator';
import { strictAssert } from '../util/assert';
import { useDevicePixelRatio } from '../hooks/useDevicePixelRatio';

const AUTODETECT_TYPE_NUMBER = 0;
const ERROR_CORRECTION_LEVEL = 'L';

type PropsType = Readonly<{
  'aria-label': string;
  className?: string;
  data: string;
  size: number;
}>;

export function QrCode(props: PropsType): ReactElement {
  // I don't think it's possible to destructure this.
  // eslint-disable-next-line react/destructuring-assignment
  const ariaLabel = props['aria-label'];
  const { className, data, size } = props;

  const qrCode = useMemo(() => {
    const result = qrcode(AUTODETECT_TYPE_NUMBER, ERROR_CORRECTION_LEVEL);
    result.addData(data);
    result.make();
    return result;
  }, [data]);

  const canvasRef = useRef<null | HTMLCanvasElement>(null);
  const dpi = useDevicePixelRatio();
  const canvasSize = size * dpi;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    strictAssert(context, 'Expected a canvas context');

    const cellSize = canvasSize / qrCode.getModuleCount();
    context.clearRect(0, 0, canvasSize, canvasSize);
    qrCode.renderTo2dContext(context, cellSize);
  }, [canvasSize, qrCode]);

  return (
    <canvas
      aria-label={ariaLabel}
      className={className}
      height={canvasSize}
      ref={canvasRef}
      style={{ width: size, height: size }}
      width={canvasSize}
    />
  );
}
