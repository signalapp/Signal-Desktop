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
import { Button, ButtonVariant } from './Button';
import { Modal } from './Modal';
import { ConfirmationDialog } from './ConfirmationDialog';
import { Spinner } from './Spinner';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  link?: string;
  username: string;
  colorId?: number;
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
}>;

const ColorEnum = Proto.AccountRecord.UsernameLink.Color;

const DEFAULT_PRESET: ColorMapEntryType = { fg: '#2449c0', bg: '#506ecd' };

export const COLOR_MAP: ReadonlyMap<number, ColorMapEntryType> = new Map([
  [ColorEnum.BLUE, DEFAULT_PRESET],
  [ColorEnum.WHITE, { fg: '#000000', bg: '#ffffff' }],
  [ColorEnum.GREY, { fg: '#464852', bg: '#6a6c74' }],
  [ColorEnum.OLIVE, { fg: '#73694f', bg: '#a89d7f' }],
  [ColorEnum.GREEN, { fg: '#55733f', bg: '#829a6e' }],
  [ColorEnum.ORANGE, { fg: '#d96b2d', bg: '#de7134' }],
  [ColorEnum.PINK, { fg: '#bb617b', bg: '#e67899' }],
  [ColorEnum.PURPLE, { fg: '#7651c5', bg: '#9c84cf' }],
]);

const CLASS = 'UsernameLinkModalBody';
const AUTODETECT_TYPE_NUMBER = 0;
const ERROR_CORRECTION_LEVEL = 'H';
const CENTER_CUTAWAY_PERCENTAGE = 32 / 184;

const PRINT_WIDTH = 296;
const DEFAULT_PRINT_HEIGHT = 324;
const PRINT_SHADOW_BLUR = 4;
const PRINT_CARD_RADIUS = 24;
const PRINT_MAX_USERNAME_WIDTH = 222;
const PRINT_USERNAME_LINE_HEIGHT = 25;
const PRINT_USERNAME_Y = 269;
const PRINT_QR_SIZE = 184;
const PRINT_QR_Y = 48;
const PRINT_QR_PADDING = 16;
const PRINT_QR_PADDING_RADIUS = 12;
const PRINT_DPI = 224;
const PRINT_LOGO_SIZE = 36;

type BlotchesPropsType = Readonly<{
  className?: string;
  link: string;
  color: string;
}>;

function Blotches({ className, link, color }: BlotchesPropsType): JSX.Element {
  const qr = QR(AUTODETECT_TYPE_NUMBER, ERROR_CORRECTION_LEVEL);
  qr.addData(link);
  qr.make();

  const size = qr.getModuleCount();
  const center = size / 2;
  const radius = CENTER_CUTAWAY_PERCENTAGE * size;

  function hasPixel(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= size || y >= size) {
      return false;
    }

    const distanceFromCenter = Math.sqrt(
      (x - center + 0.5) ** 2 + (y - center + 0.5) ** 2
    );

    // Center and 1 dot away should remain clear for the logo placement.
    if (Math.ceil(distanceFromCenter) <= radius + 2) {
      return false;
    }

    return qr.isDark(x, y);
  }

  const path = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
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

  return (
    <svg
      className={className}
      viewBox={`0 0 ${2 * size} ${2 * size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx={size}
        cy={size}
        r={radius * 2}
        stroke={color}
        strokeWidth={2}
      />
      <path d={path.join('')} fill={color} />
    </svg>
  );
}

type CreateCanvasAndContextOptionsType = Readonly<{
  width: number;
  height: number;
  devicePixelRatio?: number;
}>;

function createCanvasAndContext({
  width,
  height,
  devicePixelRatio = window.devicePixelRatio,
}: CreateCanvasAndContextOptionsType): [
  OffscreenCanvas,
  OffscreenCanvasRenderingContext2D
] {
  const canvas = new OffscreenCanvas(
    devicePixelRatio * width,
    devicePixelRatio * height
  );

  const context = canvas.getContext('2d');
  strictAssert(context, 'Failed to get 2d context');

  // Retina support
  context.scale(devicePixelRatio, devicePixelRatio);

  // Font config
  context.font = `600 20px/${PRINT_USERNAME_LINE_HEIGHT}px Inter`;
  context.textAlign = 'center';
  context.textBaseline = 'top';

  // Experimental Chrome APIs
  (
    context as unknown as {
      letterSpacing: number;
    }
  ).letterSpacing = -0.34;
  (
    context as unknown as {
      textRendering: string;
    }
  ).textRendering = 'optimizeLegibility';

  context.imageSmoothingEnabled = false;

  return [canvas, context];
}

type GetLogoCanvasOptionsType = Readonly<{
  fgColor: string;
  imageUrl?: string;
  devicePixelRatio?: number;
}>;

async function getLogoCanvas({
  fgColor,
  imageUrl = 'images/signal-qr-logo.svg',
  devicePixelRatio,
}: GetLogoCanvasOptionsType): Promise<OffscreenCanvas> {
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.addEventListener('load', resolve);
    img.addEventListener('error', () =>
      reject(new Error('Failed to load image'))
    );
    img.src = imageUrl;
  });

  const [canvas, context] = createCanvasAndContext({
    width: PRINT_LOGO_SIZE,
    height: PRINT_LOGO_SIZE,
    devicePixelRatio,
  });

  context.fillStyle = fgColor;
  context.fillRect(0, 0, PRINT_LOGO_SIZE, PRINT_LOGO_SIZE);
  context.globalCompositeOperation = 'destination-in';
  context.drawImage(img, 0, 0, PRINT_LOGO_SIZE, PRINT_LOGO_SIZE);

  return canvas;
}

function splitUsername(username: string): Array<string> {
  const result = new Array<string>();

  const [, context] = createCanvasAndContext({ width: 1, height: 1 });

  // Compute number of lines and height of username
  for (let i = 0, last = 0; i < username.length; i += 1) {
    const part = username.slice(last, i);
    if (context.measureText(part).width > PRINT_MAX_USERNAME_WIDTH) {
      result.push(username.slice(last, i - 1));
      last = i - 1;
    } else if (i === username.length - 1) {
      result.push(username.slice(last));
    }
  }

  return result;
}

type GenerateImageURLOptionsType = Readonly<{
  link: string;
  username: string;
  colorId: number;
  bgColor: string;
  fgColor: string;

  // For testing
  logoUrl?: string;
  devicePixelRatio?: number;
}>;

// Exported for testing
export async function _generateImageBlob({
  link,
  username,
  colorId,
  bgColor,
  fgColor,
  logoUrl,
  devicePixelRatio,
}: GenerateImageURLOptionsType): Promise<Blob> {
  const usernameLines = splitUsername(username);
  const usernameHeight = PRINT_USERNAME_LINE_HEIGHT * usernameLines.length;

  const isWhiteBackground = colorId === ColorEnum.WHITE;

  const padding = isWhiteBackground ? PRINT_SHADOW_BLUR : 0;

  const totalHeight =
    DEFAULT_PRINT_HEIGHT - PRINT_USERNAME_LINE_HEIGHT + usernameHeight;
  const [canvas, context] = createCanvasAndContext({
    width: PRINT_WIDTH + 2 * padding,
    height: totalHeight + 2 * padding,
    devicePixelRatio,
  });

  // Draw card
  context.save();
  if (isWhiteBackground) {
    context.shadowColor = 'rgba(0, 0, 0, 0.08)';
    context.shadowBlur = PRINT_SHADOW_BLUR;
  }
  context.fillStyle = bgColor;
  context.beginPath();
  context.roundRect(
    padding,
    padding,
    PRINT_WIDTH,
    totalHeight,
    PRINT_CARD_RADIUS
  );
  context.fill();
  context.restore();

  // Draw padding around QR code
  context.save();
  context.fillStyle = '#fff';
  const sizeWithPadding = PRINT_QR_SIZE + 2 * PRINT_QR_PADDING;
  context.beginPath();
  context.roundRect(
    padding + (PRINT_WIDTH - sizeWithPadding) / 2,
    padding + PRINT_QR_Y - PRINT_QR_PADDING,
    sizeWithPadding,
    sizeWithPadding,
    PRINT_QR_PADDING_RADIUS
  );
  context.fill();
  if (isWhiteBackground) {
    context.lineWidth = 2;
    context.strokeStyle = '#e9e9e9';
    context.stroke();
  }
  context.restore();

  // Draw username
  context.fillStyle = isWhiteBackground ? '#000' : '#fff';
  for (const [i, line] of usernameLines.entries()) {
    context.fillText(
      line,
      padding + PRINT_WIDTH / 2,
      PRINT_USERNAME_Y + i * PRINT_USERNAME_LINE_HEIGHT
    );
  }

  // Draw logo
  context.drawImage(
    await getLogoCanvas({ fgColor, imageUrl: logoUrl, devicePixelRatio }),
    padding + (PRINT_WIDTH - PRINT_LOGO_SIZE) / 2,
    padding + PRINT_QR_Y + (PRINT_QR_SIZE - PRINT_LOGO_SIZE) / 2,
    PRINT_LOGO_SIZE,
    PRINT_LOGO_SIZE
  );

  // Draw QR code
  const svg = renderToStaticMarkup(Blotches({ link, color: fgColor }));
  const svgURL = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.addEventListener('load', resolve);
    img.addEventListener('error', () =>
      reject(new Error('Failed to load image'))
    );
    img.src = svgURL;
  });

  context.drawImage(
    img,
    padding + (PRINT_WIDTH - PRINT_QR_SIZE) / 2,
    PRINT_QR_Y + padding,
    PRINT_QR_SIZE,
    PRINT_QR_SIZE
  );

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

export function UsernameLinkModalBody({
  i18n,
  link,
  username,
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
        bgColor,
        fgColor,
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
  }, [link, username, colorId, bgColor, fgColor]);

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
    setConfirmReset(false);
    resetUsernameLink();
  }, [resetUsernameLink]);

  const info = (
    <>
      <div className={classnames(`${CLASS}__actions`)}>
        <button
          className={`${CLASS}__actions__save`}
          type="button"
          disabled={!link}
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
          disabled={!link}
          onClick={onCopyLink}
          aria-label={i18n('icu:UsernameLinkModalBody__copy')}
        />
        <div className={classnames(`${CLASS}__link__text`)}>{link}</div>
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

  return (
    <div className={`${CLASS}__container`}>
      <div className={CLASS}>
        <div
          className={classnames(`${CLASS}__card`, {
            [`${CLASS}__card--shadow`]: isWhiteBackground,
          })}
          ref={onCardRef}
        >
          <div className={`${CLASS}__card__qr`}>
            {usernameLinkState === UsernameLinkState.Ready && link ? (
              <>
                <Blotches
                  className={`${CLASS}__card__qr__blotches`}
                  link={link}
                  color={fgColor}
                />
                <div className={`${CLASS}__card__qr__logo`} />
              </>
            ) : (
              <Spinner
                moduleClassName={`${CLASS}__card__qr__spinner`}
                svgSize="small"
              />
            )}
          </div>
          <div className={`${CLASS}__card__username`}>
            {!showColors && (
              <button
                className={classnames(`${CLASS}__card__username__copy`)}
                type="button"
                onClick={onCopyUsername}
                aria-label={i18n('icu:UsernameLinkModalBody__copy')}
              />
            )}
            <div className={`${CLASS}__card__username__text`}>{username}</div>
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
