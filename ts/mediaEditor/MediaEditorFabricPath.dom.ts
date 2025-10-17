// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { fabric } from 'fabric';

export class MediaEditorFabricPath extends fabric.Path {
  constructor(
    path?: string | Array<fabric.Point>,
    options?: fabric.IPathOptions
  ) {
    super(path, {
      evented: false,
      fill: undefined,
      hasControls: false,
      lockScalingFlip: true,
      selectable: false,
      ...(options || {}),
    });
  }

  static override fromObject(
    // eslint-disable-next-line max-len
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
    options: any,
    callback: (_: MediaEditorFabricPath) => unknown
  ): MediaEditorFabricPath {
    const result = new MediaEditorFabricPath(options.path, options);
    callback(result);
    return result;
  }
}

MediaEditorFabricPath.prototype.type = 'MediaEditorFabricPath';
MediaEditorFabricPath.prototype.borderColor = '#ffffff';
