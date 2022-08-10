// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Measure from 'react-measure';
import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { createPortal } from 'react-dom';
import { fabric } from 'fabric';
import { get, has, noop } from 'lodash';

import type { LocalizerType } from '../types/Util';
import type { Props as StickerButtonProps } from './stickers/StickerButton';
import type { ImageStateType } from '../mediaEditor/ImageStateType';

import * as log from '../logging/log';
import { Button, ButtonVariant } from './Button';
import { ContextMenu } from './ContextMenu';
import { Slider } from './Slider';
import { StickerButton } from './stickers/StickerButton';
import { Theme } from '../util/theme';
import { canvasToBytes } from '../util/canvasToBytes';
import { useFabricHistory } from '../mediaEditor/useFabricHistory';
import { usePortal } from '../hooks/usePortal';
import { useUniqueId } from '../hooks/useUniqueId';

import { MediaEditorFabricPencilBrush } from '../mediaEditor/MediaEditorFabricPencilBrush';
import { MediaEditorFabricCropRect } from '../mediaEditor/MediaEditorFabricCropRect';
import { MediaEditorFabricIText } from '../mediaEditor/MediaEditorFabricIText';
import { MediaEditorFabricSticker } from '../mediaEditor/MediaEditorFabricSticker';
import { fabricEffectListener } from '../mediaEditor/fabricEffectListener';
import { getRGBA, getHSL } from '../mediaEditor/util/color';
import {
  TextStyle,
  getTextStyleAttributes,
} from '../mediaEditor/util/getTextStyleAttributes';

export type PropsType = {
  doneButtonLabel?: string;
  i18n: LocalizerType;
  imageSrc: string;
  onClose: () => unknown;
  onDone: (data: Uint8Array) => unknown;
} & Pick<StickerButtonProps, 'installedPacks' | 'recentStickers'>;

const INITIAL_IMAGE_STATE: ImageStateType = {
  angle: 0,
  cropX: 0,
  cropY: 0,
  flipX: false,
  flipY: false,
  height: 0,
  width: 0,
};

enum EditMode {
  Crop = 'Crop',
  Draw = 'Draw',
  Text = 'Text',
}

enum DrawWidth {
  Thin = 2,
  Regular = 4,
  Medium = 12,
  Heavy = 24,
}

enum DrawTool {
  Pen = 'Pen',
  Highlighter = 'Highlighter',
}

type PendingCropType = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function isCmdOrCtrl(ev: KeyboardEvent): boolean {
  const { ctrlKey, metaKey } = ev;
  const commandKey = get(window, 'platform') === 'darwin' && metaKey;
  const controlKey = get(window, 'platform') !== 'darwin' && ctrlKey;
  return commandKey || controlKey;
}

export const MediaEditor = ({
  doneButtonLabel,
  i18n,
  imageSrc,
  onClose,
  onDone,

  // StickerButtonProps
  installedPacks,
  recentStickers,
}: PropsType): JSX.Element | null => {
  const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | undefined>();
  const [image, setImage] = useState<HTMLImageElement>(new Image());

  const canvasId = useUniqueId();

  const [imageState, setImageState] =
    useState<ImageStateType>(INITIAL_IMAGE_STATE);

  // History state
  const { canRedo, canUndo, redoIfPossible, takeSnapshot, undoIfPossible } =
    useFabricHistory({
      fabricCanvas,
      imageState,
      setImageState,
    });

  // Initial image load and Fabric canvas setup
  useEffect(() => {
    // This is important. We can't re-run this function if we've already setup
    //    a canvas since Fabric doesn't like that.
    if (fabricCanvas) {
      return;
    }

    const img = new Image();
    img.onload = () => {
      setImage(img);

      const canvas = new fabric.Canvas(canvasId);
      canvas.selection = false;
      setFabricCanvas(canvas);

      const newImageState = {
        ...INITIAL_IMAGE_STATE,
        height: img.height,
        width: img.width,
      };
      setImageState(newImageState);
      takeSnapshot('initial state', newImageState, canvas);
    };
    img.onerror = () => {
      // This is a bad experience, but it should be impossible.
      log.error('<MediaEditor>: image failed to load. Closing');
      onClose();
    };
    img.src = imageSrc;
    return () => {
      img.onload = noop;
      img.onerror = noop;
    };
  }, [canvasId, fabricCanvas, imageSrc, onClose, takeSnapshot]);

  // Keyboard support
  useEffect(() => {
    if (!fabricCanvas) {
      return noop;
    }

    const globalShortcuts: Array<
      [(ev: KeyboardEvent) => boolean, () => unknown]
    > = [
      [
        ev => isCmdOrCtrl(ev) && ev.key === 'c',
        () => setEditMode(EditMode.Crop),
      ],
      [
        ev => isCmdOrCtrl(ev) && ev.key === 'd',
        () => setEditMode(EditMode.Draw),
      ],
      [
        ev => isCmdOrCtrl(ev) && ev.key === 't',
        () => setEditMode(EditMode.Text),
      ],
      [ev => isCmdOrCtrl(ev) && ev.key === 'z', undoIfPossible],
      [ev => isCmdOrCtrl(ev) && ev.shiftKey && ev.key === 'z', redoIfPossible],
      [
        ev => ev.key === 'Escape',
        () => {
          setEditMode(undefined);

          if (fabricCanvas.getActiveObject()) {
            fabricCanvas.discardActiveObject();
            fabricCanvas.requestRenderAll();
          }
        },
      ],
    ];

    const objectShortcuts: Array<
      [
        (ev: KeyboardEvent) => boolean,
        (obj: fabric.Object, ev: KeyboardEvent) => unknown
      ]
    > = [
      [
        ev => ev.key === 'Delete',
        obj => {
          fabricCanvas.remove(obj);
          setEditMode(undefined);
        },
      ],
      [
        ev => ev.key === 'ArrowUp',
        (obj, ev) => {
          const px = ev.shiftKey ? 20 : 1;
          if (ev.altKey) {
            obj.set('angle', (obj.angle || 0) - px);
          } else {
            const { x, y } = obj.getCenterPoint();
            obj.setPositionByOrigin(
              new fabric.Point(x, y - px),
              'center',
              'center'
            );
          }
          obj.setCoords();
          fabricCanvas.requestRenderAll();
        },
      ],
      [
        ev => ev.key === 'ArrowLeft',
        (obj, ev) => {
          const px = ev.shiftKey ? 20 : 1;
          if (ev.altKey) {
            obj.set('angle', (obj.angle || 0) - px);
          } else {
            const { x, y } = obj.getCenterPoint();
            obj.setPositionByOrigin(
              new fabric.Point(x - px, y),
              'center',
              'center'
            );
          }
          obj.setCoords();
          fabricCanvas.requestRenderAll();
        },
      ],
      [
        ev => ev.key === 'ArrowDown',
        (obj, ev) => {
          const px = ev.shiftKey ? 20 : 1;
          if (ev.altKey) {
            obj.set('angle', (obj.angle || 0) + px);
          } else {
            const { x, y } = obj.getCenterPoint();
            obj.setPositionByOrigin(
              new fabric.Point(x, y + px),
              'center',
              'center'
            );
          }
          obj.setCoords();
          fabricCanvas.requestRenderAll();
        },
      ],
      [
        ev => ev.key === 'ArrowRight',
        (obj, ev) => {
          const px = ev.shiftKey ? 20 : 1;
          if (ev.altKey) {
            obj.set('angle', (obj.angle || 0) + px);
          } else {
            const { x, y } = obj.getCenterPoint();
            obj.setPositionByOrigin(
              new fabric.Point(x + px, y),
              'center',
              'center'
            );
          }
          obj.setCoords();
          fabricCanvas.requestRenderAll();
        },
      ],
    ];

    function handleKeydown(ev: KeyboardEvent) {
      if (!fabricCanvas) {
        return;
      }

      globalShortcuts.forEach(([conditional, runShortcut]) => {
        if (conditional(ev)) {
          runShortcut();
          ev.preventDefault();
          ev.stopPropagation();
        }
      });

      const obj = fabricCanvas.getActiveObject();

      if (
        !obj ||
        obj.excludeFromExport ||
        (obj instanceof MediaEditorFabricIText && obj.isEditing)
      ) {
        return;
      }

      objectShortcuts.forEach(([conditional, runShortcut]) => {
        if (conditional(ev)) {
          runShortcut(obj, ev);
          ev.preventDefault();
          ev.stopPropagation();
        }
      });
    }

    document.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [fabricCanvas, redoIfPossible, undoIfPossible]);

  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const zoom =
    Math.min(
      containerWidth / imageState.width,
      containerHeight / imageState.height
    ) || 1;

  // Update the canvas dimensions (and therefore zoom)
  useEffect(() => {
    if (!fabricCanvas || !imageState.width || !imageState.height) {
      return;
    }
    fabricCanvas.setDimensions({
      width: imageState.width * zoom,
      height: imageState.height * zoom,
    });
    fabricCanvas.setZoom(zoom);
  }, [
    containerHeight,
    containerWidth,
    fabricCanvas,
    imageState.height,
    imageState.width,
    zoom,
  ]);

  // Refresh the background image according to imageState changes
  useEffect(() => {
    if (!fabricCanvas) {
      return;
    }
    drawFabricBackgroundImage({ fabricCanvas, image, imageState });
  }, [fabricCanvas, image, imageState]);

  const [canCrop, setCanCrop] = useState(false);
  const [cropAspectRatioLock, setCropAspectRatioLock] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>(DrawTool.Pen);
  const [drawWidth, setDrawWidth] = useState<DrawWidth>(DrawWidth.Regular);
  const [editMode, setEditMode] = useState<EditMode | undefined>();
  const [sliderValue, setSliderValue] = useState<number>(0);
  const [textStyle, setTextStyle] = useState<TextStyle>(TextStyle.Regular);

  // If you select a text path auto enter edit mode
  useEffect(() => {
    if (!fabricCanvas) {
      return;
    }
    return fabricEffectListener(
      fabricCanvas,
      ['selection:created', 'selection:updated', 'selection:cleared'],
      () => {
        if (fabricCanvas?.getActiveObject() instanceof MediaEditorFabricIText) {
          setEditMode(EditMode.Text);
        } else if (editMode === EditMode.Text) {
          setEditMode(undefined);
        }
      }
    );
  }, [editMode, fabricCanvas]);

  // Ensure scaling is in locked|unlocked state only when cropping
  useEffect(() => {
    if (!fabricCanvas) {
      return;
    }

    if (editMode === EditMode.Crop) {
      fabricCanvas.uniformScaling = cropAspectRatioLock;
    } else {
      fabricCanvas.uniformScaling = true;
    }
  }, [cropAspectRatioLock, editMode, fabricCanvas]);

  // Remove any blank text when edit mode changes off of text
  useEffect(() => {
    if (!fabricCanvas) {
      return;
    }

    if (editMode !== EditMode.Text) {
      const obj = fabricCanvas.getActiveObject();
      if (obj && has(obj, 'text') && get(obj, 'text') === '') {
        fabricCanvas.remove(obj);
      }
    }
  }, [editMode, fabricCanvas]);

  // Toggle draw mode
  useEffect(() => {
    if (!fabricCanvas) {
      return;
    }

    if (editMode !== EditMode.Draw) {
      fabricCanvas.isDrawingMode = false;
      return;
    }

    fabricCanvas.discardActiveObject();
    fabricCanvas.isDrawingMode = true;

    const freeDrawingBrush = new MediaEditorFabricPencilBrush(fabricCanvas);
    if (drawTool === DrawTool.Highlighter) {
      freeDrawingBrush.color = getRGBA(sliderValue, 0.5);
      freeDrawingBrush.strokeLineCap = 'square';
      freeDrawingBrush.strokeLineJoin = 'miter';
      freeDrawingBrush.width = (drawWidth / zoom) * 2;
    } else {
      freeDrawingBrush.color = getHSL(sliderValue);
      freeDrawingBrush.strokeLineCap = 'round';
      freeDrawingBrush.strokeLineJoin = 'bevel';
      freeDrawingBrush.width = drawWidth / zoom;
    }
    fabricCanvas.freeDrawingBrush = freeDrawingBrush;

    fabricCanvas.requestRenderAll();
  }, [drawTool, drawWidth, editMode, fabricCanvas, sliderValue, zoom]);

  // Change text style
  useEffect(() => {
    if (!fabricCanvas) {
      return;
    }

    const obj = fabricCanvas.getActiveObject();

    if (!obj || !(obj instanceof MediaEditorFabricIText)) {
      return;
    }

    const { isEditing } = obj;
    obj.exitEditing();
    obj.set(getTextStyleAttributes(textStyle, sliderValue));
    fabricCanvas.requestRenderAll();
    if (isEditing) {
      obj.enterEditing();
    }
  }, [fabricCanvas, sliderValue, textStyle]);

  // Create the CroppingRect
  useEffect(() => {
    if (!fabricCanvas) {
      return;
    }

    if (editMode === EditMode.Crop) {
      const PADDING = MediaEditorFabricCropRect.PADDING / zoom;
      // For reasons we don't understand, height and width on small images doesn't work
      //   right (it bleeds out) so we decrease them for small images.
      const height =
        imageState.height - PADDING * Math.max(440 / imageState.height, 2);
      const width =
        imageState.width - PADDING * Math.max(440 / imageState.width, 2);

      let rect: MediaEditorFabricCropRect;
      const obj = fabricCanvas.getActiveObject();

      if (obj instanceof MediaEditorFabricCropRect) {
        rect = obj;
        rect.set({ height, width, scaleX: 1, scaleY: 1 });
      } else {
        rect = new MediaEditorFabricCropRect({
          height,
          width,
        });

        rect.on('modified', () => {
          const { height: currHeight, width: currWidth } =
            rect.getBoundingRect(true);

          setCanCrop(currHeight < height || currWidth < width);
        });

        rect.on('deselected', () => {
          setEditMode(undefined);
        });

        fabricCanvas.add(rect);
        fabricCanvas.setActiveObject(rect);
      }

      fabricCanvas.viewportCenterObject(rect);
      rect.setCoords();
    } else {
      fabricCanvas.getObjects().forEach(obj => {
        if (obj instanceof MediaEditorFabricCropRect) {
          fabricCanvas.remove(obj);
        }
      });
    }

    setCanCrop(false);
  }, [editMode, fabricCanvas, imageState.height, imageState.width, zoom]);

  // Create an IText node when edit mode changes to Text
  useEffect(() => {
    if (!fabricCanvas) {
      return;
    }

    if (editMode !== EditMode.Text) {
      return;
    }

    const obj = fabricCanvas.getActiveObject();
    if (obj instanceof MediaEditorFabricIText) {
      return;
    }

    const FONT_SIZE_RELATIVE_TO_CANVAS = 10;
    const fontSize =
      Math.min(imageState.width, imageState.height) /
      FONT_SIZE_RELATIVE_TO_CANVAS;
    const text = new MediaEditorFabricIText('', {
      ...getTextStyleAttributes(textStyle, sliderValue),
      fontSize,
    });
    text.setPositionByOrigin(
      new fabric.Point(imageState.width / 2, imageState.height / 2),
      'center',
      'center'
    );
    text.setCoords();
    fabricCanvas.add(text);
    fabricCanvas.setActiveObject(text);

    text.enterEditing();
  }, [
    editMode,
    fabricCanvas,
    imageState.height,
    imageState.width,
    sliderValue,
    textStyle,
  ]);

  const [isSaving, setIsSaving] = useState(false);

  // In an ideal world we'd use <ModalHost /> to get the nice animation benefits
  // but because of the way IText is implemented -- with a hidden textarea -- to
  // capture keyboard events, we can't use ModalHost since that traps focus, and
  // focus trapping doesn't play nice with fabric's IText.
  const portal = usePortal();

  if (!portal) {
    return null;
  }

  let tooling: JSX.Element | undefined;
  if (editMode === EditMode.Text) {
    tooling = (
      <>
        <Slider
          handleStyle={{ backgroundColor: getHSL(sliderValue) }}
          label={i18n('CustomColorEditor__hue')}
          moduleClassName="HueSlider MediaEditor__tools__tool"
          onChange={setSliderValue}
          value={sliderValue}
        />
        <ContextMenu
          i18n={i18n}
          menuOptions={[
            {
              icon: 'MediaEditor__icon--text-regular',
              label: i18n('MediaEditor__text--regular'),
              onClick: () => setTextStyle(TextStyle.Regular),
              value: TextStyle.Regular,
            },
            {
              icon: 'MediaEditor__icon--text-highlight',
              label: i18n('MediaEditor__text--highlight'),
              onClick: () => setTextStyle(TextStyle.Highlight),
              value: TextStyle.Highlight,
            },
            {
              icon: 'MediaEditor__icon--text-outline',
              label: i18n('MediaEditor__text--outline'),
              onClick: () => setTextStyle(TextStyle.Outline),
              value: TextStyle.Outline,
            },
          ]}
          moduleClassName={classNames('MediaEditor__tools__tool', {
            'MediaEditor__tools__button--text-regular':
              textStyle === TextStyle.Regular,
            'MediaEditor__tools__button--text-highlight':
              textStyle === TextStyle.Highlight,
            'MediaEditor__tools__button--text-outline':
              textStyle === TextStyle.Outline,
          })}
          theme={Theme.Dark}
          value={textStyle}
        />
        <button
          className="MediaEditor__tools__tool MediaEditor__tools__button MediaEditor__tools__button--words"
          onClick={() => {
            setEditMode(undefined);

            const activeObject = fabricCanvas?.getActiveObject();
            if (activeObject instanceof MediaEditorFabricIText) {
              activeObject.exitEditing();
            }
          }}
          type="button"
        >
          {i18n('done')}
        </button>
      </>
    );
  } else if (editMode === EditMode.Draw) {
    tooling = (
      <>
        <Slider
          handleStyle={{ backgroundColor: getHSL(sliderValue) }}
          label={i18n('CustomColorEditor__hue')}
          moduleClassName="HueSlider MediaEditor__tools__tool"
          onChange={setSliderValue}
          value={sliderValue}
        />
        <ContextMenu
          i18n={i18n}
          menuOptions={[
            {
              icon: 'MediaEditor__icon--draw-pen',
              label: i18n('MediaEditor__draw--pen'),
              onClick: () => setDrawTool(DrawTool.Pen),
              value: DrawTool.Pen,
            },
            {
              icon: 'MediaEditor__icon--draw-highlighter',
              label: i18n('MediaEditor__draw--highlighter'),
              onClick: () => setDrawTool(DrawTool.Highlighter),
              value: DrawTool.Highlighter,
            },
          ]}
          moduleClassName={classNames('MediaEditor__tools__tool', {
            'MediaEditor__tools__button--draw-pen': drawTool === DrawTool.Pen,
            'MediaEditor__tools__button--draw-highlighter':
              drawTool === DrawTool.Highlighter,
          })}
          theme={Theme.Dark}
          value={drawTool}
        />
        <ContextMenu
          i18n={i18n}
          menuOptions={[
            {
              icon: 'MediaEditor__icon--width-thin',
              label: i18n('MediaEditor__draw--thin'),
              onClick: () => setDrawWidth(DrawWidth.Thin),
              value: DrawWidth.Thin,
            },
            {
              icon: 'MediaEditor__icon--width-regular',
              label: i18n('MediaEditor__draw--regular'),
              onClick: () => setDrawWidth(DrawWidth.Regular),
              value: DrawWidth.Regular,
            },
            {
              icon: 'MediaEditor__icon--width-medium',
              label: i18n('MediaEditor__draw--medium'),
              onClick: () => setDrawWidth(DrawWidth.Medium),
              value: DrawWidth.Medium,
            },
            {
              icon: 'MediaEditor__icon--width-heavy',
              label: i18n('MediaEditor__draw--heavy'),
              onClick: () => setDrawWidth(DrawWidth.Heavy),
              value: DrawWidth.Heavy,
            },
          ]}
          moduleClassName={classNames('MediaEditor__tools__tool', {
            'MediaEditor__tools__button--width-thin':
              drawWidth === DrawWidth.Thin,
            'MediaEditor__tools__button--width-regular':
              drawWidth === DrawWidth.Regular,
            'MediaEditor__tools__button--width-medium':
              drawWidth === DrawWidth.Medium,
            'MediaEditor__tools__button--width-heavy':
              drawWidth === DrawWidth.Heavy,
          })}
          theme={Theme.Dark}
          value={drawWidth}
        />
        <button
          className="MediaEditor__tools__tool MediaEditor__tools__button MediaEditor__tools__button--words"
          onClick={() => setEditMode(undefined)}
          type="button"
        >
          {i18n('done')}
        </button>
      </>
    );
  } else if (editMode === EditMode.Crop) {
    const canReset =
      imageState.cropX !== 0 ||
      imageState.cropY !== 0 ||
      imageState.flipX ||
      imageState.flipY ||
      imageState.angle !== 0;

    tooling = (
      <>
        <button
          className="MediaEditor__tools__tool MediaEditor__tools__button MediaEditor__tools__button--words"
          disabled={!canReset}
          onClick={async () => {
            if (!fabricCanvas) {
              return;
            }

            const newImageState = {
              ...INITIAL_IMAGE_STATE,
              height: image.height,
              width: image.width,
            };
            setImageState(newImageState);
            moveFabricObjectsForReset(fabricCanvas, imageState);
            takeSnapshot('reset', newImageState);
          }}
          type="button"
        >
          {i18n('MediaEditor__crop--reset')}
        </button>
        <button
          aria-label={i18n('MediaEditor__crop--rotate')}
          className="MediaEditor__tools__tool MediaEditor__tools__button MediaEditor__tools__button--rotate"
          onClick={() => {
            if (!fabricCanvas) {
              return;
            }

            fabricCanvas.getObjects().forEach(obj => {
              if (obj instanceof MediaEditorFabricCropRect) {
                return;
              }

              const center = obj.getCenterPoint();

              obj.set('angle', ((obj.angle || 0) + 270) % 360);

              obj.setPositionByOrigin(
                new fabric.Point(center.y, imageState.width - center.x),
                'center',
                'center'
              );
              obj.setCoords();
            });

            const newImageState = {
              ...imageState,
              angle: (imageState.angle + 270) % 360,
              height: imageState.width,
              width: imageState.height,
            };
            setImageState(newImageState);
            takeSnapshot('rotate', newImageState);
          }}
          type="button"
        />
        <button
          aria-label={i18n('MediaEditor__crop--flip')}
          className="MediaEditor__tools__tool MediaEditor__tools__button MediaEditor__tools__button--flip"
          onClick={() => {
            if (!fabricCanvas) {
              return;
            }

            const newImageState = {
              ...imageState,
              ...(imageState.angle % 180
                ? { flipY: !imageState.flipY }
                : { flipX: !imageState.flipX }),
            };
            setImageState(newImageState);
            takeSnapshot('flip', newImageState);
          }}
          type="button"
        />
        <button
          aria-label={i18n('MediaEditor__crop--lock')}
          className={classNames(
            'MediaEditor__tools__button',
            `MediaEditor__tools__button--crop-${
              cropAspectRatioLock ? '' : 'un'
            }locked`
          )}
          onClick={() => {
            if (fabricCanvas) {
              fabricCanvas.uniformScaling = !cropAspectRatioLock;
            }
            setCropAspectRatioLock(!cropAspectRatioLock);
          }}
          type="button"
        />
        <button
          className="MediaEditor__tools__tool MediaEditor__tools__button MediaEditor__tools__button--words"
          disabled={!canCrop}
          onClick={() => {
            if (!fabricCanvas) {
              return;
            }

            const pendingCrop = getPendingCrop(fabricCanvas);
            if (!pendingCrop) {
              return;
            }

            const newImageState = getNewImageStateFromCrop(
              imageState,
              pendingCrop
            );
            setImageState(newImageState);
            moveFabricObjectsForCrop(fabricCanvas, pendingCrop);
            takeSnapshot('crop', newImageState);
            setEditMode(undefined);
          }}
          type="button"
        >
          {i18n('done')}
        </button>
      </>
    );
  }

  return createPortal(
    <div className="MediaEditor">
      <div className="MediaEditor__container">
        <Measure
          bounds
          onResize={({ bounds }) => {
            if (!bounds) {
              log.error('We should be measuring the bounds');
              return;
            }
            setContainerWidth(bounds.width);
            setContainerHeight(bounds.height);
          }}
        >
          {({ measureRef }) => (
            <div className="MediaEditor__media" ref={measureRef}>
              {image && (
                <div>
                  <canvas
                    className={classNames('MediaEditor__media--canvas', {
                      'MediaEditor__media--canvas--cropping':
                        editMode === EditMode.Crop,
                    })}
                    id={canvasId}
                  />
                </div>
              )}
            </div>
          )}
        </Measure>
      </div>
      <div className="MediaEditor__toolbar">
        {tooling ? (
          <div className="MediaEditor__tools">{tooling}</div>
        ) : (
          <div className="MediaEditor__toolbar--space" />
        )}
        <div className="MediaEditor__toolbar--buttons">
          <Button
            onClick={onClose}
            theme={Theme.Dark}
            variant={ButtonVariant.Secondary}
          >
            {i18n('discard')}
          </Button>
          <div className="MediaEditor__controls">
            <button
              aria-label={i18n('MediaEditor__control--draw')}
              className={classNames({
                MediaEditor__control: true,
                'MediaEditor__control--pen': true,
                'MediaEditor__control--selected': editMode === EditMode.Draw,
              })}
              onClick={() => {
                setEditMode(
                  editMode === EditMode.Draw ? undefined : EditMode.Draw
                );
              }}
              type="button"
            />
            <button
              aria-label={i18n('MediaEditor__control--text')}
              className={classNames({
                MediaEditor__control: true,
                'MediaEditor__control--text': true,
                'MediaEditor__control--selected': editMode === EditMode.Text,
              })}
              onClick={() => {
                if (editMode === EditMode.Text) {
                  setEditMode(undefined);
                  const obj = fabricCanvas?.getActiveObject();
                  if (obj instanceof MediaEditorFabricIText) {
                    obj.exitEditing();
                  }
                } else {
                  setEditMode(EditMode.Text);
                }
              }}
              type="button"
            />
            <StickerButton
              blessedPacks={[]}
              className={classNames({
                MediaEditor__control: true,
                'MediaEditor__control--sticker': true,
              })}
              clearInstalledStickerPack={noop}
              clearShowIntroduction={() => {
                // We're using this as a callback for when the sticker button
                // is pressed.
                fabricCanvas?.discardActiveObject();
                setEditMode(undefined);
              }}
              clearShowPickerHint={noop}
              i18n={i18n}
              installedPacks={installedPacks}
              knownPacks={[]}
              onPickSticker={(_packId, _stickerId, src: string) => {
                if (!fabricCanvas) {
                  return;
                }

                const STICKER_SIZE_RELATIVE_TO_CANVAS = 4;
                const size =
                  Math.min(imageState.width, imageState.height) /
                  STICKER_SIZE_RELATIVE_TO_CANVAS;

                const sticker = new MediaEditorFabricSticker(src);
                sticker.scaleToHeight(size);
                sticker.setPositionByOrigin(
                  new fabric.Point(imageState.width / 2, imageState.height / 2),
                  'center',
                  'center'
                );
                sticker.setCoords();

                fabricCanvas.add(sticker);
                fabricCanvas.setActiveObject(sticker);
                setEditMode(undefined);
              }}
              receivedPacks={[]}
              recentStickers={recentStickers}
              showPickerHint={false}
              theme={Theme.Dark}
            />
            <button
              aria-label={i18n('MediaEditor__control--crop')}
              className={classNames({
                MediaEditor__control: true,
                'MediaEditor__control--crop': true,
                'MediaEditor__control--selected': editMode === EditMode.Crop,
              })}
              onClick={() => {
                if (!fabricCanvas) {
                  return;
                }
                if (editMode === EditMode.Crop) {
                  const obj = fabricCanvas.getActiveObject();
                  if (obj instanceof MediaEditorFabricCropRect) {
                    fabricCanvas.remove(obj);
                  }
                  setEditMode(undefined);
                } else {
                  setEditMode(EditMode.Crop);
                }
              }}
              type="button"
            />
            <button
              aria-label={i18n('MediaEditor__control--undo')}
              className="MediaEditor__control MediaEditor__control--undo"
              disabled={!canUndo}
              onClick={() => {
                if (editMode === EditMode.Crop) {
                  setEditMode(undefined);
                }
                undoIfPossible();
              }}
              type="button"
            />
            <button
              aria-label={i18n('MediaEditor__control--redo')}
              className="MediaEditor__control MediaEditor__control--redo"
              disabled={!canRedo}
              onClick={() => {
                if (editMode === EditMode.Crop) {
                  setEditMode(undefined);
                }
                redoIfPossible();
              }}
              type="button"
            />
          </div>
          <Button
            disabled={!image || isSaving}
            onClick={async () => {
              if (!fabricCanvas) {
                return;
              }

              setEditMode(undefined);
              setIsSaving(true);

              let data: Uint8Array;
              try {
                const renderFabricCanvas = await cloneFabricCanvas(
                  fabricCanvas
                );

                renderFabricCanvas.remove(
                  ...renderFabricCanvas
                    .getObjects()
                    .filter(obj => obj.excludeFromExport)
                );

                let finalImageState: ImageStateType;
                const pendingCrop = getPendingCrop(fabricCanvas);
                if (pendingCrop) {
                  finalImageState = getNewImageStateFromCrop(
                    imageState,
                    pendingCrop
                  );
                  moveFabricObjectsForCrop(renderFabricCanvas, pendingCrop);
                  drawFabricBackgroundImage({
                    fabricCanvas: renderFabricCanvas,
                    image,
                    imageState: finalImageState,
                  });
                } else {
                  finalImageState = imageState;
                }

                renderFabricCanvas.setDimensions({
                  width: finalImageState.width,
                  height: finalImageState.height,
                });
                renderFabricCanvas.setZoom(1);
                const renderedCanvas = renderFabricCanvas.toCanvasElement();

                data = await canvasToBytes(renderedCanvas);
              } catch (err) {
                onClose();
                throw err;
              } finally {
                setIsSaving(false);
              }

              onDone(data);
            }}
            theme={Theme.Dark}
            variant={ButtonVariant.Primary}
          >
            {doneButtonLabel || i18n('save')}
          </Button>
        </div>
      </div>
    </div>,
    portal
  );
};

function getPendingCrop(
  fabricCanvas: fabric.Canvas
): undefined | PendingCropType {
  const activeObject = fabricCanvas.getActiveObject();
  return activeObject instanceof MediaEditorFabricCropRect
    ? activeObject.getBoundingRect(true)
    : undefined;
}

function getNewImageStateFromCrop(
  state: Readonly<ImageStateType>,
  { left, height, top, width }: Readonly<PendingCropType>
): ImageStateType {
  let cropX: number;
  let cropY: number;
  switch (state.angle) {
    case 0:
      cropX = state.cropX + left;
      cropY = state.cropY + top;
      break;
    case 90:
      cropX = state.cropX + top;
      cropY = state.cropY + (state.width - (left + width));
      break;
    case 180:
      cropX = state.cropX + (state.width - (left + width));
      cropY = state.cropY + (state.height - (top + height));
      break;
    case 270:
      cropX = state.cropX + (state.height - (top + height));
      cropY = state.cropY + left;
      break;
    default:
      throw new Error('Unexpected angle');
  }

  return {
    ...state,
    cropX,
    cropY,
    height,
    width,
  };
}

function cloneFabricCanvas(original: fabric.Canvas): Promise<fabric.Canvas> {
  return new Promise(resolve => {
    original.clone(resolve);
  });
}

function moveFabricObjectsForCrop(
  fabricCanvas: fabric.Canvas,
  { left, top }: Readonly<PendingCropType>
): void {
  fabricCanvas.getObjects().forEach(obj => {
    const { x, y } = obj.getCenterPoint();

    const translatedCenter = new fabric.Point(x - left, y - top);
    obj.setPositionByOrigin(translatedCenter, 'center', 'center');
    obj.setCoords();
  });
}

function moveFabricObjectsForReset(
  fabricCanvas: fabric.Canvas,
  oldImageState: Readonly<ImageStateType>
): void {
  fabricCanvas.getObjects().forEach(obj => {
    if (obj.excludeFromExport) {
      return;
    }

    let newCenterX: number;
    let newCenterY: number;

    // First, reset position changes caused by image rotation:
    const oldCenter = obj.getCenterPoint();
    const distanceFromRightEdge = oldImageState.width - oldCenter.x;
    const distanceFromBottomEdge = oldImageState.height - oldCenter.y;
    switch (oldImageState.angle % 360) {
      case 0:
        newCenterX = oldCenter.x;
        newCenterY = oldCenter.y;
        break;
      case 90:
        newCenterX = oldCenter.y;
        newCenterY = distanceFromRightEdge;
        break;
      case 180:
        newCenterX = distanceFromRightEdge;
        newCenterY = distanceFromBottomEdge;
        break;
      case 270:
        newCenterX = distanceFromBottomEdge;
        newCenterY = oldCenter.x;
        break;
      default:
        throw new Error('Unexpected angle');
    }

    // Next, reset position changes caused by crop:
    newCenterX += oldImageState.cropX;
    newCenterY += oldImageState.cropY;

    // It's important to set the angle *before* setting the position, because
    //   Fabric's positioning is affected by object angle.
    obj.set('angle', (obj.angle || 0) - oldImageState.angle);
    obj.setPositionByOrigin(
      new fabric.Point(newCenterX, newCenterY),
      'center',
      'center'
    );

    obj.setCoords();
  });
}

function drawFabricBackgroundImage({
  fabricCanvas,
  image,
  imageState,
}: Readonly<{
  fabricCanvas: fabric.Canvas;
  image: HTMLImageElement;
  imageState: Readonly<ImageStateType>;
}>): void {
  const backgroundImage = new fabric.Image(image, {
    canvas: fabricCanvas,
    height: imageState.height || image.height,
    width: imageState.width || image.width,
  });

  let left: number;
  let top: number;
  switch (imageState.angle) {
    case 0:
      left = 0;
      top = 0;
      break;
    case 90:
      left = imageState.width;
      top = 0;
      break;
    case 180:
      left = imageState.width;
      top = imageState.height;
      break;
    case 270:
      left = 0;
      top = imageState.height;
      break;
    default:
      throw new Error('Unexpected angle');
  }

  let { height, width } = imageState;
  if (imageState.angle % 180) {
    [width, height] = [height, width];
  }

  fabricCanvas.setBackgroundImage(
    backgroundImage,
    fabricCanvas.requestRenderAll.bind(fabricCanvas),
    {
      angle: imageState.angle,
      cropX: imageState.cropX,
      cropY: imageState.cropY,
      flipX: imageState.flipX,
      flipY: imageState.flipY,
      left,
      top,
      originX: 'left',
      originY: 'top',
      width,
      height,
    }
  );
}
