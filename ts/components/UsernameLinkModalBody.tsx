// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState, useEffect } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import classnames from 'classnames';
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
import { loadImage } from '../util/loadImage';
import { Button, ButtonVariant } from './Button';
import { Modal } from './Modal';
import { ConfirmationDialog } from './ConfirmationDialog';
import { Spinner } from './Spinner';
import { BrandedQRCode } from './BrandedQRCode';

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

const CLASS = 'UsernameLinkModalBody';

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
            <BrandedQRCode size={PRINT_QR_SIZE} link={link} color={fg} />
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
  OffscreenCanvasRenderingContext2D,
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
  direction: 'ltr' | 'rtl';
}>;

function createTextMeasurer({
  font,
  letterSpacing,
  maxWidth,
  direction,
}: CreateTextMeasurerOptionsType): (text: string) => boolean {
  const [, context] = createCanvasAndContext({ width: 1, height: 1 });

  context.font = font;
  context.direction = direction;
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
  hintDirection: 'ltr' | 'rtl';
  colorId: number;
}>;

// Exported for testing
export async function _generateImageBlob({
  link,
  username,
  hint,
  hintDirection,
  colorId,
}: GenerateImageURLOptionsType): Promise<Blob> {
  const usernameLines = splitText(username, {
    granularity: 'grapheme',
    shouldBreak: createTextMeasurer({
      maxWidth: USERNAME_MAX_WIDTH,
      font: USERNAME_FONT,
      letterSpacing: USERNAME_LETTER_SPACING,
      direction: 'ltr',
    }),
  });

  const hintLines = splitText(hint, {
    granularity: 'word',
    shouldBreak: createTextMeasurer({
      maxWidth: HINT_MAX_WIDTH,
      font: HINT_FONT,
      letterSpacing: HINT_LETTER_SPACING,
      direction: hintDirection,
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

  const img = await loadImage(svgURL);

  context.drawImage(img, 0, 0, PRINT_WIDTH, PRINT_HEIGHT);

  const isWhiteBackground = colorId === ColorEnum.WHITE;

  context.save();
  context.font = USERNAME_FONT;
  context.direction = 'ltr';
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
  context.direction = hintDirection;
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
        hintDirection: i18n.getLocaleDirection(),
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
        <BrandedQRCode size={16} link={link} color={fgColor} />
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
