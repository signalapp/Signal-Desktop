// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { fabric } from 'fabric';
import { clamp } from 'lodash';

export class MediaEditorFabricCropRect extends fabric.Rect {
  static PADDING = 4;

  constructor(options?: fabric.IRectOptions) {
    super({
      fill: undefined,
      lockScalingFlip: true,
      ...(options || {}),
    });

    this.on('modified', this.containBounds.bind(this));
  }

  private containBounds() {
    if (!this.canvas) {
      return;
    }

    const zoom = this.canvas.getZoom() || 1;

    const { left, top, height, width } = this.getBoundingRect();

    const canvasHeight = this.canvas.getHeight();
    const canvasWidth = this.canvas.getWidth();

    if (height > canvasHeight || width > canvasWidth) {
      this.canvas.discardActiveObject();
    } else {
      this.set(
        'left',
        clamp(
          left / zoom,
          MediaEditorFabricCropRect.PADDING / zoom,
          (canvasWidth - width - MediaEditorFabricCropRect.PADDING) / zoom
        )
      );
      this.set(
        'top',
        clamp(
          top / zoom,
          MediaEditorFabricCropRect.PADDING / zoom,
          (canvasHeight - height - MediaEditorFabricCropRect.PADDING) / zoom
        )
      );
    }

    this.setCoords();
  }

  override render(ctx: CanvasRenderingContext2D): void {
    super.render(ctx);

    const bounds = this.getBoundingRect();

    const zoom = this.canvas?.getZoom() || 1;
    const canvasWidth = (this.canvas?.getWidth() || 0) / zoom;
    const canvasHeight = (this.canvas?.getHeight() || 0) / zoom;
    const height = bounds.height / zoom;
    const left = bounds.left / zoom;
    const top = bounds.top / zoom;
    const width = bounds.width / zoom;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    // top
    ctx.fillRect(0, 0, canvasWidth, top);
    // left
    ctx.fillRect(0, top, left, height);
    // bottom
    ctx.fillRect(0, height + top, canvasWidth, canvasHeight - top);
    // right
    ctx.fillRect(left + width, top, canvasWidth - left, height);
    ctx.restore();
  }
}

MediaEditorFabricCropRect.prototype.controls = {
  tl: new fabric.Control({
    x: -0.5,
    y: -0.5,
    actionHandler: fabric.controlsUtils.scalingEqually,
    cursorStyle: 'nwse-resize',
    render: (
      ctx: CanvasRenderingContext2D,
      left: number,
      top: number,
      _,
      rect: fabric.Object
    ) => {
      const WIDTH = getMinSize(rect.width);

      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(left - 2, top + WIDTH);
      ctx.lineTo(left - 2, top - 2);
      ctx.lineTo(left + WIDTH, top - 2);
      ctx.stroke();

      ctx.restore();
    },
  }),
  tr: new fabric.Control({
    x: 0.5,
    y: -0.5,
    actionHandler: fabric.controlsUtils.scalingEqually,
    cursorStyle: 'nesw-resize',
    render: (
      ctx: CanvasRenderingContext2D,
      left: number,
      top: number,
      _,
      rect: fabric.Object
    ) => {
      const WIDTH = getMinSize(rect.width);

      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(left + 2, top + WIDTH);
      ctx.lineTo(left + 2, top - 2);
      ctx.lineTo(left - WIDTH, top - 2);
      ctx.stroke();

      ctx.restore();
    },
  }),
  bl: new fabric.Control({
    x: -0.5,
    y: 0.5,
    actionHandler: fabric.controlsUtils.scalingEqually,
    cursorStyle: 'nesw-resize',
    render: (
      ctx: CanvasRenderingContext2D,
      left: number,
      top: number,
      _,
      rect: fabric.Object
    ) => {
      const WIDTH = getMinSize(rect.width);

      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(left - 2, top - WIDTH);
      ctx.lineTo(left - 2, top + 2);
      ctx.lineTo(left + WIDTH, top + 2);
      ctx.stroke();

      ctx.restore();
    },
  }),
  br: new fabric.Control({
    x: 0.5,
    y: 0.5,
    actionHandler: fabric.controlsUtils.scalingEqually,
    cursorStyle: 'nwse-resize',
    render: (
      ctx: CanvasRenderingContext2D,
      left: number,
      top: number,
      _,
      rect: fabric.Object
    ) => {
      const WIDTH = getMinSize(rect.width);

      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(left + 2, top - WIDTH);
      ctx.lineTo(left + 2, top + 2);
      ctx.lineTo(left - WIDTH, top + 2);
      ctx.stroke();

      ctx.restore();
    },
  }),
};

MediaEditorFabricCropRect.prototype.excludeFromExport = true;
MediaEditorFabricCropRect.prototype.borderColor = '#ffffff';
MediaEditorFabricCropRect.prototype.cornerColor = '#ffffff';

function getMinSize(width: number | undefined): number {
  return Math.min(width || 24, 24);
}
