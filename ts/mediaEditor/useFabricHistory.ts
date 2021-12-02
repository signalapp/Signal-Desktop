// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import { fabric } from 'fabric';
import EventEmitter from 'events';

import type { ImageStateType } from './ImageStateType';
import { MediaEditorFabricIText } from './MediaEditorFabricIText';
import { MediaEditorFabricPath } from './MediaEditorFabricPath';
import { MediaEditorFabricSticker } from './MediaEditorFabricSticker';

export function useFabricHistory(
  canvas: fabric.Canvas | undefined
): FabricHistory | undefined {
  const [history, setHistory] = useState<FabricHistory | undefined>();

  // We need this type of precision so that when serializing/deserializing
  // the floats don't get rounded off and we maintain proper image state.
  // http://fabricjs.com/fabric-gotchas
  fabric.Object.NUM_FRACTION_DIGITS = 16;

  // Attach our custom classes to the global Fabric instance. Unfortunately, Fabric
  //   doesn't make it easy to deserialize into a custom class without polluting the
  //   global namespace. See <http://fabricjs.com/fabric-intro-part-3#subclassing>.
  Object.assign(fabric, {
    MediaEditorFabricIText,
    MediaEditorFabricPath,
    MediaEditorFabricSticker,
  });

  useEffect(() => {
    if (canvas) {
      const fabricHistory = new FabricHistory(canvas);
      setHistory(fabricHistory);
    }
  }, [canvas]);

  return history;
}

const LIMIT = 1000;

type SnapshotStateType = {
  canvasState: string;
  imageState: ImageStateType;
};

export class FabricHistory extends EventEmitter {
  private readonly canvas: fabric.Canvas;

  private highWatermark: number;
  private isTimeTraveling: boolean;
  private snapshots: Array<SnapshotStateType>;

  constructor(canvas: fabric.Canvas) {
    super();

    this.canvas = canvas;
    this.highWatermark = 0;
    this.isTimeTraveling = false;
    this.snapshots = [];

    this.canvas.on('object:added', this.onObjectModified.bind(this));
    this.canvas.on('object:modified', this.onObjectModified.bind(this));
    this.canvas.on('object:removed', this.onObjectModified.bind(this));
  }

  private applyState({ canvasState, imageState }: SnapshotStateType): void {
    this.canvas.loadFromJSON(canvasState, () => {
      this.emit('appliedState', imageState);
      this.emit('historyChanged');
      this.isTimeTraveling = false;
    });
  }

  private getState(): string {
    return JSON.stringify(this.canvas.toDatalessJSON());
  }

  private onObjectModified({ target }: fabric.IEvent): void {
    if (target?.excludeFromExport) {
      return;
    }

    this.emit('pleaseTakeSnapshot');
  }

  private getUndoState(): SnapshotStateType | undefined {
    if (!this.canUndo()) {
      return;
    }

    this.highWatermark -= 1;
    return this.snapshots[this.highWatermark];
  }

  private getRedoState(): SnapshotStateType | undefined {
    if (this.canRedo()) {
      this.highWatermark += 1;
    }

    return this.snapshots[this.highWatermark];
  }

  public takeSnapshot(imageState: ImageStateType): void {
    if (this.isTimeTraveling) {
      return;
    }

    if (this.canRedo()) {
      this.snapshots.splice(this.highWatermark, this.snapshots.length);
    }

    this.snapshots.push({ canvasState: this.getState(), imageState });
    if (this.snapshots.length > LIMIT) {
      this.snapshots.shift();
    }
    this.highWatermark = this.snapshots.length - 1;
    this.emit('historyChanged');
  }

  public undo(): void {
    const undoState = this.getUndoState();

    if (!undoState) {
      return;
    }

    this.isTimeTraveling = true;
    this.applyState(undoState);
  }

  public redo(): void {
    const redoState = this.getRedoState();

    if (!redoState) {
      return;
    }

    this.isTimeTraveling = true;
    this.applyState(redoState);
  }

  public canUndo(): boolean {
    return this.highWatermark > 0;
  }

  public canRedo(): boolean {
    return this.highWatermark < this.snapshots.length - 1;
  }
}
