// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { fabric } from 'fabric';

const resizeControl = new fabric.Control({
  actionHandler: fabric.controlsUtils.scalingEqually,
  cursorStyleHandler: () => 'se-resize',
  render: (ctx: CanvasRenderingContext2D, left: number, top: number) => {
    // circle
    const size = 12;
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(left, top, size, 0, 2 * Math.PI, false);
    ctx.fill();

    // arrows NW & SE
    const arrowSize = 5;
    ctx.fillStyle = '#3b3b3b';
    ctx.strokeStyle = '#3b3b3b';
    ctx.beginPath();

    // SE
    ctx.moveTo(left + 0.5, top + 0.5);
    ctx.lineTo(left + arrowSize, top + arrowSize);
    ctx.moveTo(left + arrowSize, top + 1);
    ctx.lineTo(left + arrowSize, top + arrowSize);
    ctx.lineTo(left + 1, top + arrowSize);

    // NW
    ctx.moveTo(left - 0.5, top - 0.5);
    ctx.lineTo(left - arrowSize, top - arrowSize);
    ctx.moveTo(left - arrowSize, top - 1);
    ctx.lineTo(left - arrowSize, top - arrowSize);
    ctx.lineTo(left - 1, top - arrowSize);

    ctx.stroke();
    ctx.restore();
  },
  x: 0.5,
  y: 0.5,
});

const rotateControl = new fabric.Control({
  actionHandler: fabric.controlsUtils.rotationWithSnapping,
  actionName: 'rotate',
  cursorStyleHandler: fabric.controlsUtils.rotationStyleHandler,
  offsetY: -40,
  render(
    ctx: CanvasRenderingContext2D,
    left: number,
    top: number,
    _,
    target: fabric.Object
  ) {
    const size = 5;
    ctx.save();

    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';

    // connecting line
    ctx.beginPath();
    ctx.moveTo(left, top);
    const radians = 0 - ((target.angle || 0) * Math.PI) / 180;
    const targetLeft = 40 * Math.sin(radians);
    const targetTop = 40 * Math.cos(radians);
    ctx.lineTo(left + targetLeft, top + targetTop);
    ctx.stroke();

    // circle
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.arc(left, top, size, 0, 2 * Math.PI, false);
    ctx.fill();

    ctx.restore();
  },
  withConnection: false,
  x: 0,
  y: -0.5,
});

const deleteControl = new fabric.Control({
  cursorStyleHandler: () => 'pointer',
  // This is lifted from <http://fabricjs.com/custom-control-render>.
  mouseUpHandler: (_eventData, { target }) => {
    if (!target.canvas) {
      return false;
    }
    target.canvas.remove(target);
    return true;
  },
  render: (ctx: CanvasRenderingContext2D, left: number, top: number) => {
    // circle
    const size = 12;
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(left, top, size, 0, 2 * Math.PI, false);
    ctx.fill();

    // x
    const xSize = 4;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    const topLeft = new fabric.Point(left - xSize, top - xSize);
    const topRight = new fabric.Point(left + xSize, top - xSize);
    const bottomRight = new fabric.Point(left + xSize, top + xSize);
    const bottomLeft = new fabric.Point(left - xSize, top + xSize);

    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.moveTo(topRight.x, topRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.stroke();

    ctx.restore();
  },
  x: -0.5,
  y: -0.5,
});

export const customFabricObjectControls = {
  br: resizeControl,
  mtr: rotateControl,
  tl: deleteControl,
};
