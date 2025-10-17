// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { fabric } from 'fabric';
import { customFabricObjectControls } from './util/customFabricObjectControls.dom.js';
import { getAnalogTime } from '../util/getAnalogTime.std.js';
import { strictAssert } from '../util/assert.std.js';
import { moreStyles } from './util/moreStyles.dom.js';

const { get } = lodash;

export enum AnalogClockStickerStyle {
  Arabic = 'Arabic',
  Baton = 'Baton',
  Explorer = 'Explorer',
  Dive = 'Dive',
}

const HOUR_LENGTH = 0.44;
const MIN_LENGTH = 0.69;

type ClockAsset = {
  dial: HTMLImageElement;
  hour: HTMLImageElement;
  minute: HTMLImageElement;
};

const ASSETS = new Map<AnalogClockStickerStyle, ClockAsset>();

function hydrateAssets(): void {
  if (ASSETS.size) {
    return;
  }

  const path = 'images/analog-time';

  const clocks = [
    AnalogClockStickerStyle.Arabic,
    AnalogClockStickerStyle.Baton,
    AnalogClockStickerStyle.Explorer,
    AnalogClockStickerStyle.Dive,
  ];

  clocks.forEach(name => {
    const dial = new Image();
    const hour = new Image();
    const minute = new Image();

    dial.src = `${path}/${name}.svg`;
    hour.src = `${path}/${name}-hour.svg`;
    minute.src = `${path}/${name}-minute.svg`;

    ASSETS.set(name, {
      dial,
      hour,
      minute,
    });
  });
}

function degToRad(deg: number): number {
  return deg * (Math.PI / 180);
}

type HandDimensions = {
  rad: number;
  length: number;
  width: number;
};

function drawHands(
  ctx: CanvasRenderingContext2D,
  clock: ClockAsset,
  hourDimensions: HandDimensions,
  minuteDimensions: HandDimensions,
  offset = 0
): void {
  ctx.rotate(hourDimensions.rad);
  ctx.drawImage(
    clock.hour,
    0 - hourDimensions.width / 2,
    0 - hourDimensions.length + offset,
    hourDimensions.width,
    hourDimensions.length
  );
  ctx.rotate(-hourDimensions.rad);

  ctx.rotate(minuteDimensions.rad);
  ctx.drawImage(
    clock.minute,
    0 - minuteDimensions.width / 2,
    0 - minuteDimensions.length + offset,
    minuteDimensions.width,
    minuteDimensions.length
  );
  ctx.rotate(-minuteDimensions.rad);
}

export class MediaEditorFabricAnalogTimeSticker extends fabric.Image {
  static getNextStyle(
    style?: AnalogClockStickerStyle
  ): AnalogClockStickerStyle {
    if (style === AnalogClockStickerStyle.Dive) {
      return AnalogClockStickerStyle.Arabic;
    }

    if (style === AnalogClockStickerStyle.Explorer) {
      return AnalogClockStickerStyle.Dive;
    }

    if (style === AnalogClockStickerStyle.Baton) {
      return AnalogClockStickerStyle.Explorer;
    }

    return AnalogClockStickerStyle.Baton;
  }

  constructor(options: fabric.IImageOptions = {}) {
    if (!ASSETS.size) {
      hydrateAssets();
    }

    let style: AnalogClockStickerStyle = AnalogClockStickerStyle.Arabic;
    ASSETS.forEach((asset, styleName) => {
      if (get(options, 'src') === asset.dial.src) {
        style = styleName;
      }
    });

    const clock = ASSETS.get(style);
    strictAssert(clock, 'expected clock not found');

    super(clock.dial, {
      ...options,
      data: { stickerStyle: style, timeDeg: getAnalogTime() },
    });

    this.on('modified', () => this.canvas?.bringToFront(this));
  }

  override render(ctx: CanvasRenderingContext2D): void {
    super.render(ctx);

    const { stickerStyle, timeDeg } = this.data;

    const { x, y } = this.getCenterPoint();
    const radius = this.getScaledHeight() / 2;
    const flip = this.flipX || this.flipY ? 180 : 0;
    const rawAngle = (this.angle ?? 0) - flip;

    const timeRad = {
      hour: degToRad(timeDeg.hour + rawAngle),
      minute: degToRad(timeDeg.minute + rawAngle),
    };

    ctx.save();
    ctx.translate(x, y);

    const clock = ASSETS.get(stickerStyle);
    strictAssert(clock, 'expected clock not found');

    if (stickerStyle === AnalogClockStickerStyle.Arabic) {
      const offset = radius * 0.106;

      drawHands(
        ctx,
        clock,
        {
          rad: timeRad.hour,
          length: radius * HOUR_LENGTH,
          width: radius * 0.049,
        },
        {
          rad: timeRad.minute,
          length: radius * MIN_LENGTH,
          width: radius * 0.036,
        },
        offset
      );
    }

    if (stickerStyle === AnalogClockStickerStyle.Baton) {
      const offset = radius * 0.106;

      drawHands(
        ctx,
        clock,
        {
          rad: timeRad.hour,
          length: radius * HOUR_LENGTH,
          width: radius * 0.09,
        },
        {
          rad: timeRad.minute,
          length: radius * MIN_LENGTH,
          width: radius * 0.09,
        },
        offset
      );
    }

    if (stickerStyle === AnalogClockStickerStyle.Explorer) {
      drawHands(
        ctx,
        clock,
        {
          rad: timeRad.hour,
          length: radius * HOUR_LENGTH,
          width: radius * 0.07,
        },
        {
          rad: timeRad.minute,
          length: radius * MIN_LENGTH,
          width: radius * 0.07,
        }
      );
    }

    if (stickerStyle === AnalogClockStickerStyle.Dive) {
      drawHands(
        ctx,
        clock,
        {
          rad: timeRad.hour,
          length: radius * 0.47,
          width: radius * 0.095,
        },
        {
          rad: timeRad.minute,
          length: radius * 0.89,
          width: radius * 0.095,
        }
      );

      // Circle
      const circleSize = radius * 0.08;
      ctx.fillStyle = '#d1ffc1';
      ctx.strokeStyle = '#d1ffc1';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, circleSize, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  static fromObject(
    // eslint-disable-next-line max-len
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
    options: any,
    callback: (_: MediaEditorFabricAnalogTimeSticker) => unknown
  ): void {
    callback(new MediaEditorFabricAnalogTimeSticker(options));
  }
}

const moreStylesControl = new fabric.Control({
  ...moreStyles,
  mouseUpHandler: (_eventData, { target }) => {
    const stickerStyle = MediaEditorFabricAnalogTimeSticker.getNextStyle(
      target.data.stickerStyle
    );

    target.setOptions({
      data: {
        ...target.data,
        stickerStyle,
      },
    });

    const clock = ASSETS.get(stickerStyle);
    strictAssert(clock, 'expected clock not found');
    const img = target as fabric.Image;
    img.setElement(clock.dial);

    target.setCoords();
    target.canvas?.requestRenderAll();
    return true;
  },
});

MediaEditorFabricAnalogTimeSticker.prototype.type =
  'MediaEditorFabricAnalogTimeSticker';
MediaEditorFabricAnalogTimeSticker.prototype.borderColor = '#ffffff';
MediaEditorFabricAnalogTimeSticker.prototype.controls = {
  ...customFabricObjectControls,
  mb: moreStylesControl,
};
