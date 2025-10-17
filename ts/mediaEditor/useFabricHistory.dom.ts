// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState } from 'react';
import { fabric } from 'fabric';

import { createLogger } from '../logging/log.std.js';

import type { ImageStateType } from './ImageStateType.std.js';
import { MediaEditorFabricAnalogTimeSticker } from './MediaEditorFabricAnalogTimeSticker.dom.js';
import { MediaEditorFabricDigitalTimeSticker } from './MediaEditorFabricDigitalTimeSticker.dom.js';
import { MediaEditorFabricIText } from './MediaEditorFabricIText.dom.js';
import { MediaEditorFabricPath } from './MediaEditorFabricPath.dom.js';
import { MediaEditorFabricSticker } from './MediaEditorFabricSticker.dom.js';
import { fabricEffectListener } from './fabricEffectListener.std.js';
import { strictAssert } from '../util/assert.std.js';

const log = createLogger('useFabricHistory');

type SnapshotStateType = {
  canvasState: string;
  imageState: ImageStateType;
};

const SNAPSHOT_LIMIT = 1000;

/**
 * A helper hook to manage `<MediaEditor>`'s undo/redo state.
 *
 * There are 3 pieces of state here:
 *
 * 1. `snapshots`, which include the "canvas state" (i.e., where all the objects are) and
 *    the "image state" (i.e., the dimensions/angle of the image). Once the image has
 *    loaded, this will always have a length of at least 1.
 * 2. `highWatermark`, representing the snapshot that we *want* to be applied. If the
 *    user never hits Undo, this will always be `snapshots.length`.
 * 3. `appliedHighWatermark`, representing the snapshot that *is* applied. Because undo
 *    and redo are asynchronous, this can lag behind `highWatermark`. The user is in the
 *    middle of a "time travel" if `highWatermark !== appliedHighWatermark`.
 *
 * When the user performs a normal operation (such as adding an object or cropping), we
 * add a new snapshot and update `highWatermark` and `appliedHighWatermark` all at once.
 * We can do this because it's a synchronous operation.
 *
 * When the user performs an undo/redo, we immediately update `highWatermark`, then
 * asynchronously perform the operation, then update `appliedHighWatermark`. You can't
 * undo/redo if you're already time traveling to help avoid race conditions.
 */
export function useFabricHistory({
  fabricCanvas,
  imageState,
  setImageState,
}: {
  fabricCanvas: fabric.Canvas | undefined;
  imageState: Readonly<ImageStateType>;
  setImageState: (_: ImageStateType) => unknown;
}): {
  canRedo: boolean;
  canUndo: boolean;
  redoIfPossible: () => void;
  takeSnapshot: (
    logMessage: string,
    imageState: ImageStateType,
    canvasOverride?: fabric.Canvas
  ) => void;
  undoIfPossible: () => void;
} {
  // These are all in one object, instead of three `useState` calls, because we often
  //   need to update them all at once based on the previous state.
  const [state, setState] = useState<
    Readonly<{
      snapshots: ReadonlyArray<SnapshotStateType>;
      highWatermark: number;
      appliedHighWatermark: number;
    }>
  >({
    snapshots: [],
    highWatermark: 0,
    appliedHighWatermark: 0,
  });

  const { highWatermark, snapshots } = state;
  const isTimeTraveling = getIsTimeTraveling(state);
  const desiredSnapshot: undefined | SnapshotStateType =
    snapshots[highWatermark - 1];

  const takeSnapshotInternal = useCallback((snapshot: SnapshotStateType) => {
    setState(oldState => {
      const newSnapshots = oldState.snapshots.slice(0, oldState.highWatermark);
      newSnapshots.push(snapshot);
      while (newSnapshots.length > SNAPSHOT_LIMIT) {
        newSnapshots.shift();
      }
      return {
        snapshots: newSnapshots,
        highWatermark: newSnapshots.length,
        appliedHighWatermark: newSnapshots.length,
      };
    });
  }, []);
  const takeSnapshot = useCallback(
    (
      logMessage: string,
      newImageState: ImageStateType,
      canvasOverride?: fabric.Canvas
    ) => {
      const canvas = canvasOverride || fabricCanvas;
      strictAssert(
        canvas,
        'Media editor: tried to take a snapshot without a canvas'
      );
      log.info(
        `Media editor: taking snapshot of image state from ${logMessage}`
      );
      takeSnapshotInternal({
        canvasState: getCanvasState(canvas),
        imageState: newImageState,
      });
    },
    [fabricCanvas, takeSnapshotInternal]
  );
  const undoIfPossible = useCallback(() => {
    log.info('Media editor: undoing');
    setState(oldState =>
      getIsTimeTraveling(oldState)
        ? oldState
        : {
            ...oldState,
            highWatermark: Math.max(oldState.highWatermark - 1, 1),
          }
    );
  }, []);
  const redoIfPossible = useCallback(() => {
    log.info('Media editor: redoing');
    setState(oldState =>
      getIsTimeTraveling(oldState)
        ? oldState
        : {
            ...oldState,
            highWatermark: Math.min(
              oldState.highWatermark + 1,
              oldState.snapshots.length
            ),
          }
    );
  }, []);

  // Global Fabric overrides
  useEffect(() => {
    // We need this type of precision so that when serializing/deserializing
    // the floats don't get rounded off and we maintain proper image state.
    // http://fabricjs.com/fabric-gotchas
    fabric.Object.NUM_FRACTION_DIGITS = 16;

    // Attach our custom classes to the global Fabric instance. Unfortunately, Fabric
    //   doesn't make it easy to deserialize into a custom class without polluting the
    //   global namespace. See <http://fabricjs.com/fabric-intro-part-3#subclassing>.
    Object.assign(fabric, {
      MediaEditorFabricAnalogTimeSticker,
      MediaEditorFabricDigitalTimeSticker,
      MediaEditorFabricIText,
      MediaEditorFabricPath,
      MediaEditorFabricSticker,
    });
  }, []);

  // Moving between different snapshots
  useEffect(() => {
    if (!fabricCanvas || !isTimeTraveling || !desiredSnapshot) {
      return;
    }
    log.info(`Media editor: time-traveling to snapshot ${highWatermark}`);
    fabricCanvas.loadFromJSON(desiredSnapshot.canvasState, () => {
      setImageState(desiredSnapshot.imageState);
      setState(oldState => ({
        ...oldState,
        appliedHighWatermark: highWatermark,
      }));
    });
  }, [
    desiredSnapshot,
    fabricCanvas,
    highWatermark,
    isTimeTraveling,
    setImageState,
  ]);

  // Taking snapshots when objects are added, modified, and removed
  useEffect(() => {
    if (!fabricCanvas || isTimeTraveling) {
      return;
    }
    return fabricEffectListener(
      fabricCanvas,
      // We want to take snapshots when objects are added, removed, and modified. The
      //   first two are obvious. We DON'T want to take snapshots before those things
      //   happen (like `object:moving`), and we also don't want to take redundant ones
      //   (which is why we don't listen to both `object:modified` and `object:rotated`).
      //
      // See <http://fabricjs.com/docs/fabric.Canvas.html#Canvas> for the list of events.
      ['object:added', 'object:modified', 'object:removed'],
      ({ target }) => {
        if (isTimeTraveling || target?.excludeFromExport) {
          return;
        }
        log.info('Media editor: taking snapshot from object change');
        takeSnapshotInternal({
          canvasState: getCanvasState(fabricCanvas),
          imageState,
        });
      }
    );
  }, [takeSnapshotInternal, fabricCanvas, isTimeTraveling, imageState]);

  return {
    canRedo: highWatermark < snapshots.length,
    canUndo: highWatermark > 1,
    redoIfPossible,
    takeSnapshot,
    undoIfPossible,
  };
}

function getCanvasState(fabricCanvas: fabric.Canvas): string {
  return JSON.stringify(fabricCanvas.toDatalessJSON(['data']));
}

function getIsTimeTraveling({
  highWatermark,
  appliedHighWatermark,
}: Readonly<{ highWatermark: number; appliedHighWatermark: number }>): boolean {
  return highWatermark !== appliedHighWatermark;
}
