// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { fabric } from 'fabric';
import { clamp } from 'lodash';
import { strictAssert } from '../util/assert';

export class MediaEditorFabricCropRect extends fabric.Rect {
  static PADDING = 4;

  constructor(options?: fabric.IRectOptions) {
    super({
      fill: undefined,
      lockScalingFlip: true,
      ...(options || {}),
    });

    this.on('scaling', this.#containBounds);
    this.on('moving', this.#containBounds);
  }

  #containBounds = () => {
    if (!this.canvas) {
      return;
    }

    const zoom = this.canvas.getZoom() ?? 1;
    const { left, top, width, height } = this.getBoundingRect(true, true);
    const { scaleX, scaleY } = this;

    strictAssert(scaleX, 'Expected scaleX to be defined');
    strictAssert(scaleY, 'Expected scaleY to be defined');

    const canvasHeight = this.canvas.getHeight() / zoom;
    const canvasWidth = this.canvas.getWidth() / zoom;

    const padding = MediaEditorFabricCropRect.PADDING / zoom;

    const nextLeft = clamp(left, padding, canvasWidth - width - padding);
    const nextTop = clamp(top, padding, canvasHeight - height - padding);

    const nextScaleX = clamp(scaleX, 0, 1);
    const nextScaleY = clamp(scaleY, 0, 1);

    this.left = nextLeft;
    this.top = nextTop;
    this.scaleX = nextScaleX;
    this.scaleY = nextScaleY;

    this.setCoords();
    this.saveState();
  };

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

const CONTROL_DEFAULT_SIZE = 24;
const CONTROL_HITBOX_SIZE = 48;

enum Corner {
  TopLeft,
  TopRight,
  BottomLeft,
  BottomRight,
}

const cursorStyle: Record<Corner, string> = {
  [Corner.TopLeft]: 'nwse-resize',
  [Corner.TopRight]: 'nesw-resize',
  [Corner.BottomLeft]: 'nesw-resize',
  [Corner.BottomRight]: 'nwse-resize',
};

function getMinSize(width: number | undefined): number {
  return Math.min(width ?? CONTROL_DEFAULT_SIZE, CONTROL_DEFAULT_SIZE);
}

function createControl(corner: Corner) {
  const onTopSide = corner === Corner.TopLeft || corner === Corner.TopRight;
  const onLeftSide = corner === Corner.TopLeft || corner === Corner.BottomLeft;
  return new fabric.Control({
    x: onLeftSide ? -0.5 : 0.5,
    y: onTopSide ? -0.5 : 0.5,
    actionHandler: fabric.controlsUtils.scalingEqually,
    cursorStyle: cursorStyle[corner],
    sizeX: CONTROL_HITBOX_SIZE,
    sizeY: CONTROL_HITBOX_SIZE,

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
      const yStart = onTopSide ? top + WIDTH : top - WIDTH;
      const yEnd = onTopSide ? top - 2 : top + 2;
      const xStart = onLeftSide ? left - 2 : left + 2;
      const xEnd = onLeftSide ? left + WIDTH : left - WIDTH;
      ctx.moveTo(xStart, yStart);
      ctx.lineTo(xStart, yEnd);
      ctx.lineTo(xEnd, yEnd);
      ctx.stroke();
      ctx.restore();
    },
  });
}

MediaEditorFabricCropRect.prototype.controls = {
  tl: createControl(Corner.TopLeft),
  tr: createControl(Corner.TopRight),
  bl: createControl(Corner.BottomLeft),
  br: createControl(Corner.BottomRight),
};

MediaEditorFabricCropRect.prototype.excludeFromExport = true;
MediaEditorFabricCropRect.prototype.borderColor = '#ffffff';
MediaEditorFabricCropRect.prototype.cornerColor = '#ffffff';
