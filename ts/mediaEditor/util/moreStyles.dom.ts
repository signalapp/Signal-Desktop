// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

function render(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number
): void {
  ctx.save();

  ctx.font = '11px Inter';
  const text = window.SignalContext.i18n('icu:MediaEditor__clock-more-styles');
  const textMetrics = ctx.measureText(text);

  const boxHeight = textMetrics.fontBoundingBoxAscent * 2;
  const boxWidth = textMetrics.width * 1.5;
  const boxX = left - boxWidth / 2;
  const textX = left - textMetrics.width / 2;
  const textY = top + boxHeight / 1.5;

  // box
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(boxX, top, boxWidth, boxHeight, 4);
  ctx.closePath();
  ctx.fill();

  // text
  ctx.fillStyle = '#fff';
  ctx.fillText(text, textX, textY);

  ctx.restore();
}

export const moreStyles = {
  cursorStyleHandler: (): 'pointer' => 'pointer',
  offsetY: 20,
  render,
  sizeX: 100,
  sizeY: 33,
  withConnection: true,
  x: 0,
  y: 0.5,
};
