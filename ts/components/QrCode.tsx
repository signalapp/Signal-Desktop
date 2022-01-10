// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React, { useEffect, useMemo, useRef } from 'react';
import qrcode from 'qrcode-generator';
import { getEnvironment, Environment } from '../environment';
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

  // Add a development-only feature to copy a QR code to the clipboard by double-clicking.
  // This can be used to quickly inspect the code, or to link this Desktop with an iOS
  // simulator primary, which has a debug-only option to paste the linking URL instead of
  // scanning it. (By the time you read this comment Android may have a similar feature.)
  const onDoubleClick = () => {
    if (getEnvironment() === Environment.Production) {
      return;
    }

    navigator.clipboard.writeText(data);

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.style.filter = 'brightness(50%)';
    window.setTimeout(() => {
      canvas.style.filter = '';
    }, 150);
  };

  return (
    <canvas
      aria-label={ariaLabel}
      className={className}
      height={canvasSize}
      ref={canvasRef}
      style={{ width: size, height: size }}
      width={canvasSize}
      onDoubleClick={onDoubleClick}
    />
  );
}
