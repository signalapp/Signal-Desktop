// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { fabric } from 'fabric';
import { customFabricObjectControls } from './util/customFabricObjectControls.dom.js';
import { moreStyles } from './util/moreStyles.dom.js';
import { getDateTimeFormatter } from '../util/formatTimestamp.dom.js';

export enum DigitalClockStickerStyle {
  White = 'White',
  Black = 'Black',
  Light = 'Light',
  Dark = 'Dark',
  Orange = 'Orange',
}

function getTextStyle(style: DigitalClockStickerStyle): {
  fill: string;
  textBackgroundColor: string;
} {
  if (style === DigitalClockStickerStyle.Black) {
    return {
      fill: '#000',
      textBackgroundColor: '',
    };
  }

  if (style === DigitalClockStickerStyle.Light) {
    return {
      fill: '#fff',
      textBackgroundColor: 'rgba(255, 255, 255, 0.4)',
    };
  }

  if (style === DigitalClockStickerStyle.Dark) {
    return {
      fill: '#fff',
      textBackgroundColor: 'rgba(0, 0, 0, 0.4)',
    };
  }

  if (style === DigitalClockStickerStyle.Orange) {
    return {
      fill: '#ff7629',
      textBackgroundColor: 'rgba(0, 0, 0, 0.6)',
    };
  }

  return {
    fill: '#fff',
    textBackgroundColor: '',
  };
}

const TEXT_PROPS = {
  editable: false,
  fontWeight: '400',
  left: 0,
  lockScalingFlip: true,
  originX: 'center',
  originY: 'center',
  textAlign: 'center',
  top: 0,
};

export class MediaEditorFabricDigitalTimeSticker extends fabric.Group {
  static getNextStyle(
    style?: DigitalClockStickerStyle
  ): DigitalClockStickerStyle {
    if (style === DigitalClockStickerStyle.White) {
      return DigitalClockStickerStyle.Black;
    }

    if (style === DigitalClockStickerStyle.Black) {
      return DigitalClockStickerStyle.Light;
    }

    if (style === DigitalClockStickerStyle.Light) {
      return DigitalClockStickerStyle.Dark;
    }

    if (style === DigitalClockStickerStyle.Dark) {
      return DigitalClockStickerStyle.Orange;
    }

    return DigitalClockStickerStyle.White;
  }

  constructor(
    timestamp: number,
    style: DigitalClockStickerStyle = DigitalClockStickerStyle.White,
    options: fabric.IGroupOptions = {}
  ) {
    const parts = getDateTimeFormatter({
      hour: 'numeric',
      minute: 'numeric',
    }).formatToParts(timestamp);
    const { fill } = getTextStyle(style);

    let dayPeriodText = '';
    const timeText = parts.reduce((acc, part) => {
      if (part.type === 'dayPeriod') {
        dayPeriodText = part.value;
        return acc;
      }
      return `${acc}${part.value}`;
    }, '');

    const timeTextNode = new fabric.IText(timeText.trim(), {
      ...TEXT_PROPS,
      fill,
      fontSize: 72,
      fontFamily: '"Hatsuishi Large", Hatsuishi, Inter',
    });

    const dayPeriodTextNode = new fabric.IText(dayPeriodText, {
      ...TEXT_PROPS,
      fill,
      fontSize: 11,
      fontFamily: 'Inter',
    });

    const dayPeriodBounds = dayPeriodTextNode.getBoundingRect();
    const timeBounds = timeTextNode.getBoundingRect();
    const totalWidth = dayPeriodBounds.width + timeBounds.width;

    dayPeriodTextNode.set({
      left: totalWidth / 2 + dayPeriodBounds.width / 2,
      top: timeBounds.height / 2 - dayPeriodBounds.height * 1.66,
    });

    super([timeTextNode, dayPeriodTextNode], {
      ...options,
      data: { stickerStyle: style, timestamp },
    });

    this.set('width', totalWidth * 2);
  }

  static override fromObject(
    // eslint-disable-next-line max-len
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
    options: any,
    callback: (_: MediaEditorFabricDigitalTimeSticker) => unknown
  ): MediaEditorFabricDigitalTimeSticker {
    const timestamp = options?.data.timestamp ?? Date.now();

    const result = new MediaEditorFabricDigitalTimeSticker(
      timestamp,
      options.data?.stickerStyle,
      options
    );
    callback(result);
    return result;
  }

  override render(ctx: CanvasRenderingContext2D): void {
    const { textBackgroundColor } = getTextStyle(this.data.stickerStyle);

    if (textBackgroundColor) {
      const bounds = this.getBoundingRect();
      const zoom = this.canvas?.getZoom() || 1;
      const height = bounds.height / zoom;
      const left = bounds.left / zoom;
      const top = bounds.top / zoom;
      const width = bounds.width / zoom;

      ctx.save();

      ctx.fillStyle = textBackgroundColor;
      ctx.beginPath();
      ctx.roundRect(left, top, width, height, 14);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    super.render(ctx);
  }
}

const moreStylesControl = new fabric.Control({
  ...moreStyles,
  mouseUpHandler: (_eventData, { target }) => {
    const stickerStyle = MediaEditorFabricDigitalTimeSticker.getNextStyle(
      target.data.stickerStyle
    );

    target.setOptions({
      data: {
        ...target.data,
        stickerStyle,
      },
    });

    const styleAttrs = getTextStyle(stickerStyle);

    const group = target as fabric.Group;
    group.getObjects().forEach(textObject => {
      textObject.set({ fill: styleAttrs.fill });
    });

    target.setCoords();
    target.canvas?.requestRenderAll();
    return true;
  },
});

MediaEditorFabricDigitalTimeSticker.prototype.type =
  'MediaEditorFabricDigitalTimeSticker';
MediaEditorFabricDigitalTimeSticker.prototype.controls = {
  ...customFabricObjectControls,
  mb: moreStylesControl,
};
