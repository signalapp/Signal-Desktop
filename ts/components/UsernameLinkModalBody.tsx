// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState, useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import classnames from 'classnames';
import QR from 'qrcode-generator';
import { changeDpiBlob } from 'changedpi';

import { SignalService as Proto } from '../protobuf';
import type { SaveAttachmentActionCreatorType } from '../state/ducks/conversations';
import { UsernameLinkState } from '../state/ducks/usernameEnums';
import { ToastType } from '../types/Toast';
import type { ShowToastAction } from '../state/ducks/toast';
import type { LocalizerType } from '../types/Util';
import { IMAGE_PNG } from '../types/MIME';
import { strictAssert } from '../util/assert';
import { drop } from '../util/drop';
import { splitText } from '../util/splitText';
import { Button, ButtonVariant } from './Button';
import { Modal } from './Modal';
import { ConfirmationDialog } from './ConfirmationDialog';
import { Spinner } from './Spinner';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  link?: string;
  username: string;
  colorId?: number;
  usernameLinkCorrupted: boolean;
  usernameLinkState: UsernameLinkState;

  setUsernameLinkColor: (colorId: number) => void;
  resetUsernameLink: () => void;
  saveAttachment: SaveAttachmentActionCreatorType;
  showToast: ShowToastAction;
  onBack: () => void;
}>;

export type ColorMapEntryType = Readonly<{
  fg: string;
  bg: string;
  tint: string;
}>;

const ColorEnum = Proto.AccountRecord.UsernameLink.Color;

const DEFAULT_PRESET: ColorMapEntryType = {
  fg: '#2449c0',
  bg: '#506ecd',
  tint: '#ecf0fb',
};

export const COLOR_MAP: ReadonlyMap<number, ColorMapEntryType> = new Map([
  [ColorEnum.BLUE, DEFAULT_PRESET],
  [ColorEnum.WHITE, { fg: '#000000', bg: '#ffffff', tint: '#f5f5f5' }],
  [ColorEnum.GREY, { fg: '#464852', bg: '#6a6c75', tint: '#f0f0f1' }],
  [ColorEnum.OLIVE, { fg: '#73694f', bg: '#aa9c7c', tint: '#f6f5f2' }],
  [ColorEnum.GREEN, { fg: '#55733f', bg: '#7c9b69', tint: '#f1f5f0' }],
  [ColorEnum.ORANGE, { fg: '#d96b2d', bg: '#ee691a', tint: '#fef1ea' }],
  [ColorEnum.PINK, { fg: '#bb617b', bg: '#f77099', tint: '#fef1f5' }],
  [ColorEnum.PURPLE, { fg: '#7651c5', bg: '#a183d4', tint: '#f5f3fb' }],
]);

const LOGO_PATH =
  'M16.904 32.723V35a17.034 17.034 0 0 1-5.594-1.334l.595-2.22a14.763 14' +
  '.763 0 0 0 5 1.277ZM9.119 33.064l.667-2.49-5.707 1.338 1.18-5.034-2.3' +
  '82.209-1.22 5.204A1.7 1.7 0 0 0 3.7 34.334l5.419-1.27ZM3.28 19.159c.1' +
  '5 1.91.671 3.77 1.53 5.477l-2.41.21a17.037 17.037 0 0 1-1.397-5.688H3' +
  '.28ZM3.277 16.885H1c.146-2.223.727-4.4 1.712-6.403l1.972 1.139a14.765' +
  ' 14.765 0 0 0-1.407 5.264ZM5.821 9.652 3.85 8.513a17.035 17.035 0 0 1' +
  ' 4.69-4.68l1.138 1.972a14.763 14.763 0 0 0-3.856 3.847ZM11.648 4.672l' +
  '-1.139-1.973c2-.978 4.172-1.556 6.395-1.699v2.277a14.762 14.762 0 0 0' +
  '-5.256 1.395ZM19.177 3.283c1.816.145 3.593.625 5.24 1.42l1.137-1.973a' +
  '17.034 17.034 0 0 0-6.377-1.725v2.278ZM29.795 9.118c.14.186.276.376.4' +
  '07.568l1.971-1.139a17.035 17.035 0 0 0-4.654-4.675l-1.138 1.973a14.76' +
  '3 14.763 0 0 1 3.414 3.273ZM32.52 15.322c.096.518.163 1.04.203 1.563H' +
  '35a17.048 17.048 0 0 0-1.694-6.367l-1.973 1.14c.552 1.16.952 2.391 1.' +
  '187 3.664ZM32.188 22.09a14.759 14.759 0 0 1-.871 2.287l1.972 1.139a17' +
  '.032 17.032 0 0 0 1.708-6.357H32.72a14.768 14.768 0 0 1-.532 2.93ZM28' +
  '.867 27.995a14.757 14.757 0 0 1-2.504 2.173l1.139 1.973a17.028 17.028' +
  ' 0 0 0 4.65-4.657l-1.972-1.139c-.396.58-.835 1.13-1.313 1.65ZM23.259 ' +
  '31.797c-1.314.5-2.69.809-4.082.92v2.278a17.033 17.033 0 0 0 6.358-1.7' +
  '16l-1.139-1.972c-.371.179-.75.342-1.137.49Z M11.66 7.265a12.463 12.46' +
  '3 0 0 1 11.9-.423 12.466 12.466 0 0 1 6.42 14.612 12.47 12.47 0 0 1-1' +
  '3.21 8.954 12.462 12.462 0 0 1-5.411-1.857L6.246 29.75l1.199-5.115a12' +
  '.47 12.47 0 0 1 4.216-17.37Z';

const CLASS = 'UsernameLinkModalBody';
const AUTODETECT_TYPE_NUMBER = 0;
const ERROR_CORRECTION_LEVEL = 'H';
const CENTER_CUTAWAY_PERCENTAGE = 30 / 184;
const CENTER_LOGO_PERCENTAGE = 38 / 184;
const QR_NATIVE_SIZE = 36;

export const PRINT_WIDTH = 424;
export const PRINT_HEIGHT = 576;
const PRINT_PIXEL_RATIO = 3;
const PRINT_QR_SIZE = 184;
const PRINT_DPI = 300;
const BASE_PILL_WIDTH = 296;
const BASE_PILL_HEIGHT = 324;
const USERNAME_TOP = 352;
const USERNAME_MAX_WIDTH = 222;
const USERNAME_LINE_HEIGHT = 26;
const USERNAME_FONT = `600 20px/${USERNAME_LINE_HEIGHT}px Inter`;
const USERNAME_LETTER_SPACING = -0.34;

const HINT_BASE_TOP = 447;
const HINT_MAX_WIDTH = 296;
const HINT_LINE_HEIGHT = 17;
const HINT_FONT = `400 14px/${HINT_LINE_HEIGHT}px Inter`;
const HINT_LETTER_SPACING = 0;

type BlotchesPropsType = Readonly<{
  size: number;
  link: string;
  color: string;
}>;

function QRCode({ size, link, color }: BlotchesPropsType): JSX.Element {
  const qr = QR(AUTODETECT_TYPE_NUMBER, ERROR_CORRECTION_LEVEL);
  qr.addData(link);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const center = moduleCount / 2;
  const radius = CENTER_CUTAWAY_PERCENTAGE * moduleCount;

  function hasPixel(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= moduleCount || y >= moduleCount) {
      return false;
    }

    const distanceFromCenter = Math.sqrt(
      (x - center + 0.5) ** 2 + (y - center + 0.5) ** 2
    );

    // Center and 1 dot away should remain clear for the logo placement.
    if (Math.ceil(distanceFromCenter) <= radius + 3) {
      return false;
    }

    return qr.isDark(x, y);
  }

  const path = [];
  for (let y = 0; y < moduleCount; y += 1) {
    for (let x = 0; x < moduleCount; x += 1) {
      if (!hasPixel(x, y)) {
        continue;
      }

      const onTop = hasPixel(x, y - 1);
      const onBottom = hasPixel(x, y + 1);
      const onLeft = hasPixel(x - 1, y);
      const onRight = hasPixel(x + 1, y);

      const roundTL = !onLeft && !onTop;
      const roundTR = !onTop && !onRight;
      const roundBR = !onRight && !onBottom;
      const roundBL = !onBottom && !onLeft;

      path.push(
        `M${2 * x} ${2 * y + 1}`,
        roundTL ? 'a1 1 0 0 1 1 -1' : 'v-1h1',
        roundTR ? 'a1 1 0 0 1 1 1' : 'h1v1',
        roundBR ? 'a1 1 0 0 1 -1 1' : 'v1h-1',
        roundBL ? 'a1 1 0 0 1 -1 -1' : 'h-1v-1',
        'z'
      );
    }
  }

  const QR_SCALE = size / 2 / moduleCount;

  const CENTER_X = size / 2;
  const CENTER_Y = size / 2;
  const LOGO_SIZE = CENTER_LOGO_PERCENTAGE * size;
  const LOGO_X = CENTER_X - LOGO_SIZE / 2;
  const LOGO_Y = CENTER_Y - LOGO_SIZE / 2;
  const LOGO_SCALE = LOGO_SIZE / QR_NATIVE_SIZE;

  return (
    <>
      <g transform={`scale(${QR_SCALE} ${QR_SCALE})`}>
        <path d={path.join('')} fill={color} />

        <circle
          cx={moduleCount}
          cy={moduleCount}
          r={radius * 2}
          stroke={color}
          strokeWidth={2}
        />
      </g>

      <g
        transform={`translate(${LOGO_X} ${LOGO_Y}) scale(${LOGO_SCALE} ${LOGO_SCALE})`}
      >
        <path fill={color} d={LOGO_PATH} />
      </g>
    </>
  );
}

type ExportedImagePropsType = Readonly<{
  link: string;
  colorId: number;
  usernameLines: number;
}>;

function ExportedImage({
  link,
  colorId,
  usernameLines,
}: ExportedImagePropsType): JSX.Element {
  const { fg, bg, tint } = COLOR_MAP.get(colorId) ?? DEFAULT_PRESET;

  const isWhiteBackground = colorId === ColorEnum.WHITE;

  const extraHeight = (usernameLines - 1) * USERNAME_LINE_HEIGHT;
  const pillHeight = BASE_PILL_HEIGHT + extraHeight;

  return (
    <svg
      style={{ position: 'absolute' }}
      viewBox={`0 0 ${PRINT_WIDTH} ${PRINT_HEIGHT}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={PRINT_WIDTH} height={PRINT_HEIGHT} fill={tint} />

      {/* QR + Username pill */}
      <g transform="translate(64, 80)">
        <rect width={BASE_PILL_WIDTH} height={pillHeight} rx="32" fill={bg} />

        {/* QR code with a frame */}
        <g transform="translate(40, 32)">
          {isWhiteBackground ? (
            <rect
              width="216"
              height="216"
              rx="12"
              fill="white"
              strokeWidth="2"
              stroke="#e9e9e9"
            />
          ) : (
            <rect width="216" height="216" rx="12" fill="white" />
          )}

          <g transform="translate(16, 16)">
            <QRCode size={PRINT_QR_SIZE} link={link} color={fg} />
          </g>
        </g>
      </g>
    </svg>
  );
}

type CreateCanvasAndContextOptionsType = Readonly<{
  width: number;
  height: number;
}>;

function createCanvasAndContext({
  width,
  height,
}: CreateCanvasAndContextOptionsType): [
  OffscreenCanvas,
  OffscreenCanvasRenderingContext2D
] {
  const canvas = new OffscreenCanvas(
    PRINT_PIXEL_RATIO * width,
    PRINT_PIXEL_RATIO * height
  );

  const context = canvas.getContext('2d');
  strictAssert(context, 'Failed to get 2d context');

  // Retina support
  context.scale(PRINT_PIXEL_RATIO, PRINT_PIXEL_RATIO);

  // Common font config
  context.textAlign = 'center';
  context.textBaseline = 'top';
  (
    context as unknown as {
      textRendering: string;
    }
  ).textRendering = 'optimizeLegibility';

  context.imageSmoothingEnabled = false;

  return [canvas, context];
}

type CreateTextMeasurerOptionsType = Readonly<{
  font: string;
  letterSpacing: number;
  maxWidth: number;
}>;

function createTextMeasurer({
  font,
  letterSpacing,
  maxWidth,
}: CreateTextMeasurerOptionsType): (text: string) => boolean {
  const [, context] = createCanvasAndContext({ width: 1, height: 1 });

  context.font = font;
  // Experimental Chrome APIs
  (
    context as unknown as {
      letterSpacing: number;
    }
  ).letterSpacing = letterSpacing;

  return value => context.measureText(value).width > maxWidth;
}

type GenerateImageURLOptionsType = Readonly<{
  link: string;
  username: string;
  hint: string;
  colorId: number;
}>;

// Exported for testing
export async function _generateImageBlob({
  link,
  username,
  hint,
  colorId,
}: GenerateImageURLOptionsType): Promise<Blob> {
  const usernameLines = splitText(username, {
    granularity: 'grapheme',
    shouldBreak: createTextMeasurer({
      maxWidth: USERNAME_MAX_WIDTH,
      font: USERNAME_FONT,
      letterSpacing: USERNAME_LETTER_SPACING,
    }),
  });

  const hintLines = splitText(hint, {
    granularity: 'word',
    shouldBreak: createTextMeasurer({
      maxWidth: HINT_MAX_WIDTH,
      font: HINT_FONT,
      letterSpacing: HINT_LETTER_SPACING,
    }),
  });

  const [canvas, context] = createCanvasAndContext({
    width: PRINT_WIDTH,
    height: PRINT_HEIGHT,
  });

  const svg = renderToStaticMarkup(
    <ExportedImage
      link={link}
      colorId={colorId}
      usernameLines={usernameLines.length}
    />
  );
  const svgURL = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.addEventListener('load', resolve);
    img.addEventListener('error', () =>
      reject(new Error('Failed to load image'))
    );
    img.src = svgURL;
  });

  context.drawImage(img, 0, 0, PRINT_WIDTH, PRINT_HEIGHT);

  const isWhiteBackground = colorId === ColorEnum.WHITE;

  context.save();
  context.font = USERNAME_FONT;
  // Experimental Chrome APIs
  (
    context as unknown as {
      letterSpacing: number;
    }
  ).letterSpacing = USERNAME_LETTER_SPACING;
  context.fillStyle = isWhiteBackground ? '#000' : '#fff';

  const centerX = PRINT_WIDTH / 2;
  for (const [i, line] of usernameLines.entries()) {
    context.fillText(line, centerX, USERNAME_TOP + i * USERNAME_LINE_HEIGHT);
  }
  context.restore();

  context.save();
  context.font = HINT_FONT;
  // Experimental Chrome APIs
  (
    context as unknown as {
      letterSpacing: number;
    }
  ).letterSpacing = HINT_LETTER_SPACING;
  context.fillStyle = 'rgba(60, 60, 69, 0.70)';

  const hintTop =
    HINT_BASE_TOP + (usernameLines.length - 1) * USERNAME_LINE_HEIGHT;
  for (const [i, line] of hintLines.entries()) {
    context.fillText(line, centerX, hintTop + i * HINT_LINE_HEIGHT);
  }
  context.restore();

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return changeDpiBlob(blob, PRINT_DPI);
}

type UsernameLinkColorRadioPropsType = Readonly<{
  i18n: LocalizerType;
  index: number;
  colorId: number;
  fgColor: string;
  bgColor: string;
  isSelected: boolean;
  onSelect: (colorId: number) => void;
}>;

function UsernameLinkColorRadio({
  i18n,
  index,
  colorId,
  fgColor,
  bgColor,
  isSelected,
  onSelect,
}: UsernameLinkColorRadioPropsType): JSX.Element {
  const className = `${CLASS}__colors__radio`;

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onSelect(colorId);
    },
    [colorId, onSelect]
  );

  const onRef = useCallback(
    (elem: HTMLButtonElement | null): void => {
      if (elem) {
        // Note that these cannot be set through html attributes
        elem.style.setProperty('--bg-color', bgColor);
        elem.style.setProperty('--fg-color', fgColor);
      }
    },
    [fgColor, bgColor]
  );

  const isWhiteBackground = colorId === ColorEnum.WHITE;

  return (
    <button
      ref={onRef}
      className={classnames(className, {
        [`${className}--white-bg`]: isWhiteBackground,
      })}
      type="button"
      aria-label={i18n('icu:UsernameLinkModalBody__color__radio', {
        index: index + 1,
        total: COLOR_MAP.size,
      })}
      aria-pressed={isSelected}
      onClick={onClick}
    >
      <i />
    </button>
  );
}

type UsernameLinkColorsPropsType = Readonly<{
  i18n: LocalizerType;
  value: number;
  onChange: (colorId: number) => void;
  onSave: () => void;
  onCancel: () => void;
}>;

function UsernameLinkColors({
  i18n,
  value,
  onChange,
  onSave,
  onCancel,
}: UsernameLinkColorsPropsType): JSX.Element {
  const className = `${CLASS}__colors`;

  const normalizedValue = value === ColorEnum.UNKNOWN ? ColorEnum.BLUE : value;

  return (
    <div className={className}>
      <div className={`${className}__grid`}>
        {[...COLOR_MAP.entries()].map(([colorId, { fg, bg }], index) => {
          return (
            <UsernameLinkColorRadio
              key={colorId}
              i18n={i18n}
              colorId={colorId}
              fgColor={fg}
              bgColor={bg}
              index={index}
              isSelected={colorId === normalizedValue}
              onSelect={onChange}
            />
          );
        })}
      </div>
      <Modal.ButtonFooter>
        <Button variant={ButtonVariant.Secondary} onClick={onCancel}>
          {i18n('icu:cancel')}
        </Button>
        <Button variant={ButtonVariant.Primary} onClick={onSave}>
          {i18n('icu:save')}
        </Button>
      </Modal.ButtonFooter>
    </div>
  );
}

enum ResetModalVisibility {
  NotMounted = 'NotMounted',
  Closed = 'Closed',
  Open = 'Open',
}

export function UsernameLinkModalBody({
  i18n,
  link,
  username,
  usernameLinkCorrupted,
  usernameLinkState,
  colorId: initialColorId = ColorEnum.UNKNOWN,

  setUsernameLinkColor,
  resetUsernameLink,
  saveAttachment,
  showToast,

  onBack,
}: PropsType): JSX.Element {
  const [pngData, setPngData] = useState<Uint8Array | undefined>();
  const [showColors, setShowColors] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetModalVisibility, setResetModalVisibility] = useState(
    ResetModalVisibility.NotMounted
  );
  const [showError, setShowError] = useState(false);
  const [colorId, setColorId] = useState(initialColorId);

  const { fg: fgColor, bg: bgColor } = COLOR_MAP.get(colorId) ?? DEFAULT_PRESET;

  const isWhiteBackground = colorId === ColorEnum.WHITE;
  const onCardRef = useCallback(
    (elem: HTMLDivElement | null): void => {
      if (elem) {
        // Note that these cannot be set through html attributes
        elem.style.setProperty('--bg-color', bgColor);
        elem.style.setProperty('--fg-color', fgColor);
        elem.style.setProperty(
          '--text-color',
          isWhiteBackground ? '#000' : '#fff'
        );
      }
    },
    [bgColor, fgColor, isWhiteBackground]
  );

  useEffect(() => {
    let isAborted = false;
    async function run() {
      if (!link) {
        return;
      }

      const blob = await _generateImageBlob({
        link,
        username,
        colorId,
        hint: i18n('icu:UsernameLinkModalBody__hint'),
      });
      const arrayBuffer = await blob.arrayBuffer();
      if (isAborted) {
        return;
      }
      setPngData(new Uint8Array(arrayBuffer));
    }

    drop(run());

    return () => {
      isAborted = true;
    };
  }, [i18n, link, username, colorId, bgColor, fgColor]);

  const onSave = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!pngData) {
        return;
      }

      saveAttachment({
        data: pngData,
        fileName: 'signal-username-qr-code.png',
        contentType: IMAGE_PNG,
        size: pngData.length,
      });
    },
    [saveAttachment, pngData]
  );

  const onStartColorChange = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    setShowColors(true);
  }, []);

  const onCopyLink = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (link) {
        drop(window.navigator.clipboard.writeText(link));
        showToast({ toastType: ToastType.CopiedUsernameLink });
      }
    },
    [link, showToast]
  );

  const onCopyUsername = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      drop(window.navigator.clipboard.writeText(username));
      showToast({ toastType: ToastType.CopiedUsername });
    },
    [username, showToast]
  );

  // Color change sub modal

  const onUsernameLinkColorChange = useCallback((newColor: number) => {
    setColorId(newColor);
  }, []);

  const onUsernameLinkColorSave = useCallback(() => {
    setUsernameLinkColor(colorId);
    setShowColors(false);
  }, [setUsernameLinkColor, colorId]);

  const onUsernameLinkColorCancel = useCallback(() => {
    setShowColors(false);
    setColorId(initialColorId);
  }, [initialColorId]);

  // Reset sub modal

  const onClickReset = useCallback(() => {
    setConfirmReset(true);
  }, []);

  const onCancelReset = useCallback(() => {
    setConfirmReset(false);
  }, []);

  const onConfirmReset = useCallback(() => {
    setShowError(false);
    setConfirmReset(false);
    resetUsernameLink();
  }, [resetUsernameLink]);

  const onCloseError = useCallback(() => {
    if (showError) {
      onBack();
    }
  }, [showError, onBack]);

  useEffect(() => {
    if (!usernameLinkCorrupted) {
      return;
    }

    resetUsernameLink();
  }, [usernameLinkCorrupted, resetUsernameLink]);

  useEffect(() => {
    if (usernameLinkState !== UsernameLinkState.Error) {
      return;
    }

    setShowError(true);
  }, [usernameLinkState]);

  const onResetModalClose = useCallback(() => {
    setResetModalVisibility(ResetModalVisibility.Closed);
  }, []);

  const isReady = usernameLinkState === UsernameLinkState.Ready;
  const isResettingLink = usernameLinkCorrupted || !isReady;

  useEffect(() => {
    setResetModalVisibility(x => {
      // Initial mount shouldn't show the modal
      if (x === ResetModalVisibility.NotMounted || isResettingLink) {
        return ResetModalVisibility.Closed;
      }

      return ResetModalVisibility.Open;
    });
  }, [isResettingLink]);

  const info = (
    <>
      <div className={classnames(`${CLASS}__actions`)}>
        <button
          className={`${CLASS}__actions__save`}
          type="button"
          disabled={!link || isResettingLink}
          onClick={onSave}
        >
          <i />
          {i18n('icu:UsernameLinkModalBody__save')}
        </button>

        <button
          className={`${CLASS}__actions__color`}
          type="button"
          onClick={onStartColorChange}
        >
          <i />
          {i18n('icu:UsernameLinkModalBody__color')}
        </button>
      </div>

      <div className={classnames(`${CLASS}__link`)}>
        <button
          className={classnames(`${CLASS}__link__icon`)}
          type="button"
          disabled={!link || isResettingLink}
          onClick={onCopyLink}
          aria-label={i18n('icu:UsernameLinkModalBody__copy')}
        />
        <div
          className={classnames(`${CLASS}__link__text`, {
            [`${CLASS}__link__text--resetting`]: isResettingLink,
          })}
        >
          {isResettingLink
            ? i18n('icu:UsernameLinkModalBody__resetting-link')
            : link}
        </div>
      </div>

      <div className={classnames(`${CLASS}__help`)}>
        {i18n('icu:UsernameLinkModalBody__help')}
      </div>

      <button
        className={classnames(`${CLASS}__reset`)}
        type="button"
        onClick={onClickReset}
      >
        {i18n('icu:UsernameLinkModalBody__reset')}
      </button>

      <Button
        className={classnames(`${CLASS}__done`)}
        variant={ButtonVariant.Primary}
        onClick={onBack}
      >
        {i18n('icu:UsernameLinkModalBody__done')}
      </Button>
    </>
  );

  let linkImage: JSX.Element | undefined;
  if (isReady && link) {
    linkImage = (
      <svg
        className={`${CLASS}__card__qr__blotches`}
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <QRCode size={16} link={link} color={fgColor} />
      </svg>
    );
  } else if (usernameLinkState === UsernameLinkState.Error) {
    linkImage = <i className={`${CLASS}__card__qr__error-icon`} />;
  } else {
    linkImage = (
      <Spinner
        moduleClassName={`${CLASS}__card__qr__spinner`}
        svgSize="small"
      />
    );
  }

  return (
    <div className={`${CLASS}__container`}>
      <div className={CLASS}>
        <div
          className={classnames(`${CLASS}__card`, {
            [`${CLASS}__card--shadow`]: isWhiteBackground,
          })}
          ref={onCardRef}
        >
          <div className={`${CLASS}__card__qr`}>{linkImage}</div>
          <div className={`${CLASS}__card__username`}>
            {showColors ? (
              <div className={`${CLASS}__card__username__text`}>{username}</div>
            ) : (
              <button
                className={`${CLASS}__card__username__copy__button`}
                type="button"
                onClick={onCopyUsername}
                aria-label={i18n('icu:UsernameLinkModalBody__copy')}
              >
                <i />
                <div className={`${CLASS}__card__username__text`}>
                  {username}
                </div>
              </button>
            )}
          </div>
        </div>

        {confirmReset && (
          <ConfirmationDialog
            i18n={i18n}
            dialogName="UsernameLinkModal__confirm-reset"
            onClose={onCancelReset}
            actions={[
              {
                action: onConfirmReset,
                style: 'negative',
                text: i18n('icu:UsernameLinkModalBody__reset'),
              },
            ]}
          >
            {i18n('icu:UsernameLinkModalBody__reset__confirm')}
          </ConfirmationDialog>
        )}

        {showError && (
          <ConfirmationDialog
            i18n={i18n}
            dialogName="UsernameLinkModal__error"
            onClose={onCloseError}
            cancelButtonVariant={ButtonVariant.Secondary}
            cancelText={i18n('icu:cancel')}
            actions={[
              {
                action: onConfirmReset,
                style: 'affirmative',
                text: i18n('icu:UsernameLinkModalBody__error__fix-now'),
              },
            ]}
          >
            {i18n('icu:UsernameLinkModalBody__error__text')}
          </ConfirmationDialog>
        )}

        {resetModalVisibility === ResetModalVisibility.Open && (
          <ConfirmationDialog
            i18n={i18n}
            dialogName="UsernameLinkModal__error"
            onClose={onResetModalClose}
            cancelButtonVariant={ButtonVariant.Secondary}
            cancelText={i18n('icu:ok')}
          >
            {i18n('icu:UsernameLinkModalBody__recovered__text')}
          </ConfirmationDialog>
        )}

        {showColors ? (
          <UsernameLinkColors
            i18n={i18n}
            value={colorId}
            onChange={onUsernameLinkColorChange}
            onSave={onUsernameLinkColorSave}
            onCancel={onUsernameLinkColorCancel}
          />
        ) : (
          info
        )}
      </div>
    </div>
  );
}
