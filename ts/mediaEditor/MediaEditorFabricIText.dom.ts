// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { fabric } from 'fabric';
import { customFabricObjectControls } from './util/customFabricObjectControls.dom.js';

export class MediaEditorFabricIText extends fabric.IText {
  constructor(text: string, options: fabric.ITextOptions) {
    super(text, {
      fontFamily: 'Inter',
      fontWeight: 'bold',
      lockScalingFlip: true,
      originX: 'center',
      originY: 'center',
      textAlign: 'center',
      ...options,
    });

    this.on('modified', () => this.canvas?.bringToFront(this));
  }

  static override fromObject(
    // eslint-disable-next-line max-len
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
    options: any,
    callback: (_: MediaEditorFabricIText) => unknown
  ): MediaEditorFabricIText {
    const result = new MediaEditorFabricIText(options.text, options);
    callback(result);
    return result;
  }
}

MediaEditorFabricIText.prototype.type = 'MediaEditorFabricIText';
MediaEditorFabricIText.prototype.lockScalingFlip = true;
MediaEditorFabricIText.prototype.borderColor = '#ffffff';
MediaEditorFabricIText.prototype.controls = customFabricObjectControls;
