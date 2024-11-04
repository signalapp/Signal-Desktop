// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { fabric } from 'fabric';
import { loadImage } from '../util/loadImage';
import { customFabricObjectControls } from './util/customFabricObjectControls';

export class MediaEditorFabricSticker extends fabric.Image {
  constructor(
    element: string | HTMLImageElement | HTMLVideoElement,
    options: fabric.IImageOptions = {}
  ) {
    // Fabric seems to have issues when passed a string, but not an Image.
    let normalizedElement: undefined | HTMLImageElement | HTMLVideoElement;
    if (typeof element === 'string') {
      normalizedElement = new Image();
      normalizedElement.src = element;
    } else {
      normalizedElement = element;
    }

    super(normalizedElement, options);

    this.on('modified', () => this.canvas?.bringToFront(this));
  }

  static async fromObject(
    // eslint-disable-next-line max-len
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
    options: any,
    callback: (_: MediaEditorFabricSticker | null, isError: boolean) => unknown
  ): Promise<void> {
    let { src } = options;
    try {
      if (typeof src === 'string') {
        src = await loadImage(src);
      }
      callback(new MediaEditorFabricSticker(src, options), false);
    } catch {
      callback(null, true);
    }
  }
}

MediaEditorFabricSticker.prototype.type = 'MediaEditorFabricSticker';
MediaEditorFabricSticker.prototype.borderColor = '#ffffff';
MediaEditorFabricSticker.prototype.controls = customFabricObjectControls;
