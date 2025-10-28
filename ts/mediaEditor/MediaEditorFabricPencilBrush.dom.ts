// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { fabric } from 'fabric';
import { MediaEditorFabricPath } from './MediaEditorFabricPath.dom.js';

export class MediaEditorFabricPencilBrush extends fabric.PencilBrush {
  public strokeMiterLimit: undefined | number;

  override createPath(
    pathData?: string | Array<fabric.Point>
  ): MediaEditorFabricPath {
    return new MediaEditorFabricPath(pathData, {
      fill: undefined,
      stroke: this.color,
      strokeWidth: this.width,
      strokeLineCap: this.strokeLineCap,
      strokeMiterLimit: this.strokeMiterLimit,
      strokeLineJoin: this.strokeLineJoin,
      strokeDashArray: this.strokeDashArray,
    });
  }
}
