// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import FocusTrap from 'focus-trap-react';
import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { get, has } from 'lodash';
import { usePopper } from 'react-popper';

import type { LinkPreviewType } from '../types/message/LinkPreviews';
import type { LocalizerType } from '../types/Util';
import type { TextAttachmentType } from '../types/Attachment';

import { Button, ButtonVariant } from './Button';
import { ContextMenu } from './ContextMenu';
import { LinkPreviewSourceType, findLinks } from '../types/LinkPreview';
import { Input } from './Input';
import { Slider } from './Slider';
import { StagedLinkPreview } from './conversation/StagedLinkPreview';
import { TextAttachment } from './TextAttachment';
import { Theme, themeClassName } from '../util/theme';
import { getRGBA, getRGBANumber } from '../mediaEditor/util/color';
import {
  COLOR_BLACK_INT,
  COLOR_WHITE_INT,
  getBackgroundColor,
} from '../util/getStoryBackground';
import { objectMap } from '../util/objectMap';

export type PropsType = {
  debouncedMaybeGrabLinkPreview: (
    message: string,
    source: LinkPreviewSourceType
  ) => unknown;
  i18n: LocalizerType;
  linkPreview?: LinkPreviewType;
  onClose: () => unknown;
  onDone: (textAttachment: TextAttachmentType) => unknown;
};

enum TextStyle {
  Default,
  Regular,
  Bold,
  Serif,
  Script,
  Condensed,
}

enum TextBackground {
  None,
  Background,
  Inverse,
}

const BackgroundStyle = {
  BG1099: { angle: 191, endColor: 4282529679, startColor: 4294260804 },
  BG1098: { startColor: 4293938406, endColor: 4279119837, angle: 192 },
  BG1031: { startColor: 4294950980, endColor: 4294859832, angle: 175 },
  BG1101: { startColor: 4278227945, endColor: 4286632135, angle: 180 },
  BG1100: { startColor: 4284861868, endColor: 4278884698, angle: 180 },
  BG1070: { color: 4294951251 },
  BG1080: { color: 4291607859 },
  BG1079: { color: 4286869806 },
  BG1083: { color: 4278825851 },
  BG1095: { color: 4287335417 },
  BG1088: { color: 4283519478 },
  BG1077: { color: 4294405742 },
  BG1094: { color: 4291315265 },
  BG1097: { color: 4291216549 },
  BG1074: { color: 4288976277 },
  BG1092: { color: 4280887593 },
};

type BackgroundStyleType = typeof BackgroundStyle[keyof typeof BackgroundStyle];

function getBackground(
  bgStyle: BackgroundStyleType
): Pick<TextAttachmentType, 'color' | 'gradient'> {
  if (has(bgStyle, 'color')) {
    return { color: get(bgStyle, 'color') };
  }

  const angle = get(bgStyle, 'angle');
  const startColor = get(bgStyle, 'startColor');
  const endColor = get(bgStyle, 'endColor');

  return {
    gradient: { angle, startColor, endColor },
  };
}

function getBgButtonAriaLabel(
  i18n: LocalizerType,
  textBackground: TextBackground
): string {
  if (textBackground === TextBackground.Background) {
    return i18n('StoryCreator__text-bg--background');
  }

  if (textBackground === TextBackground.Inverse) {
    return i18n('StoryCreator__text-bg--inverse');
  }

  return i18n('StoryCreator__text-bg--none');
}

export const TextStoryCreator = ({
  debouncedMaybeGrabLinkPreview,
  i18n,
  linkPreview,
  onClose,
  onDone,
}: PropsType): JSX.Element => {
  const [isEditingText, setIsEditingText] = useState(false);
  const [selectedBackground, setSelectedBackground] =
    useState<BackgroundStyleType>(BackgroundStyle.BG1099);
  const [textStyle, setTextStyle] = useState<TextStyle>(TextStyle.Regular);
  const [textBackground, setTextBackground] = useState<TextBackground>(
    TextBackground.None
  );
  const [sliderValue, setSliderValue] = useState<number>(100);
  const [text, setText] = useState<string>('');

  const textEditorRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEditingText) {
      textEditorRef.current?.focus();
    } else {
      textEditorRef.current?.blur();
    }
  }, [isEditingText]);

  const [isColorPickerShowing, setIsColorPickerShowing] = useState(false);
  const [colorPickerPopperButtonRef, setColorPickerPopperButtonRef] =
    useState<HTMLButtonElement | null>(null);
  const [colorPickerPopperRef, setColorPickerPopperRef] =
    useState<HTMLDivElement | null>(null);

  const colorPickerPopper = usePopper(
    colorPickerPopperButtonRef,
    colorPickerPopperRef,
    {
      modifiers: [
        {
          name: 'arrow',
        },
      ],
      placement: 'top',
      strategy: 'fixed',
    }
  );

  const [hasLinkPreviewApplied, setHasLinkPreviewApplied] = useState(false);
  const [linkPreviewInputValue, setLinkPreviewInputValue] = useState('');

  useEffect(() => {
    if (!linkPreviewInputValue) {
      return;
    }
    debouncedMaybeGrabLinkPreview(
      linkPreviewInputValue,
      LinkPreviewSourceType.StoryCreator
    );
  }, [debouncedMaybeGrabLinkPreview, linkPreviewInputValue]);

  useEffect(() => {
    if (!text) {
      return;
    }
    debouncedMaybeGrabLinkPreview(text, LinkPreviewSourceType.StoryCreator);
  }, [debouncedMaybeGrabLinkPreview, text]);

  useEffect(() => {
    if (!linkPreview || !text) {
      return;
    }

    const links = findLinks(text);

    const shouldApplyLinkPreview = links.includes(linkPreview.url);
    setHasLinkPreviewApplied(shouldApplyLinkPreview);
  }, [linkPreview, text]);

  const [isLinkPreviewInputShowing, setIsLinkPreviewInputShowing] =
    useState(false);
  const [linkPreviewInputPopperButtonRef, setLinkPreviewInputPopperButtonRef] =
    useState<HTMLButtonElement | null>(null);
  const [linkPreviewInputPopperRef, setLinkPreviewInputPopperRef] =
    useState<HTMLDivElement | null>(null);

  const linkPreviewInputPopper = usePopper(
    linkPreviewInputPopperButtonRef,
    linkPreviewInputPopperRef,
    {
      modifiers: [
        {
          name: 'arrow',
        },
      ],
      placement: 'top',
      strategy: 'fixed',
    }
  );

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!colorPickerPopperButtonRef?.contains(event.target as Node)) {
        setIsColorPickerShowing(false);
        event.stopPropagation();
        event.preventDefault();
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsColorPickerShowing(false);
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isColorPickerShowing, colorPickerPopperButtonRef]);

  const sliderColorNumber = getRGBANumber(sliderValue);

  let textForegroundColor = sliderColorNumber;
  let textBackgroundColor: number | undefined;

  if (textBackground === TextBackground.Background) {
    textBackgroundColor = COLOR_WHITE_INT;
    textForegroundColor =
      sliderValue >= 95 ? COLOR_BLACK_INT : sliderColorNumber;
  } else if (textBackground === TextBackground.Inverse) {
    textBackgroundColor =
      sliderValue >= 95 ? COLOR_BLACK_INT : sliderColorNumber;
    textForegroundColor = COLOR_WHITE_INT;
  }

  const textAttachment: TextAttachmentType = {
    ...getBackground(selectedBackground),
    text,
    textStyle,
    textForegroundColor,
    textBackgroundColor,
    preview: hasLinkPreviewApplied ? linkPreview : undefined,
  };

  const hasChanges = Boolean(text || hasLinkPreviewApplied);

  return (
    <FocusTrap focusTrapOptions={{ allowOutsideClick: true }}>
      <div className="StoryCreator">
        <div className="StoryCreator__container">
          <TextAttachment
            disableLinkPreviewPopup
            i18n={i18n}
            isEditingText={isEditingText}
            onChange={setText}
            onClick={() => {
              if (!isEditingText) {
                setIsEditingText(true);
              }
            }}
            onRemoveLinkPreview={() => {
              setHasLinkPreviewApplied(false);
            }}
            textAttachment={textAttachment}
          />
        </div>
        <div className="StoryCreator__toolbar">
          {isEditingText ? (
            <div className="StoryCreator__tools">
              <Slider
                handleStyle={{ backgroundColor: getRGBA(sliderValue) }}
                label={getRGBA(sliderValue)}
                moduleClassName="HueSlider StoryCreator__tools__tool"
                onChange={setSliderValue}
                value={sliderValue}
              />
              <ContextMenu
                i18n={i18n}
                menuOptions={[
                  {
                    icon: 'StoryCreator__icon--font-regular',
                    label: i18n('StoryCreator__text--regular'),
                    onClick: () => setTextStyle(TextStyle.Regular),
                    value: TextStyle.Regular,
                  },
                  {
                    icon: 'StoryCreator__icon--font-bold',
                    label: i18n('StoryCreator__text--bold'),
                    onClick: () => setTextStyle(TextStyle.Bold),
                    value: TextStyle.Bold,
                  },
                  {
                    icon: 'StoryCreator__icon--font-serif',
                    label: i18n('StoryCreator__text--serif'),
                    onClick: () => setTextStyle(TextStyle.Serif),
                    value: TextStyle.Serif,
                  },
                  {
                    icon: 'StoryCreator__icon--font-script',
                    label: i18n('StoryCreator__text--script'),
                    onClick: () => setTextStyle(TextStyle.Script),
                    value: TextStyle.Script,
                  },
                  {
                    icon: 'StoryCreator__icon--font-condensed',
                    label: i18n('StoryCreator__text--condensed'),
                    onClick: () => setTextStyle(TextStyle.Condensed),
                    value: TextStyle.Condensed,
                  },
                ]}
                moduleClassName={classNames('StoryCreator__tools__tool', {
                  'StoryCreator__tools__button--font-regular':
                    textStyle === TextStyle.Regular,
                  'StoryCreator__tools__button--font-bold':
                    textStyle === TextStyle.Bold,
                  'StoryCreator__tools__button--font-serif':
                    textStyle === TextStyle.Serif,
                  'StoryCreator__tools__button--font-script':
                    textStyle === TextStyle.Script,
                  'StoryCreator__tools__button--font-condensed':
                    textStyle === TextStyle.Condensed,
                })}
                theme={Theme.Dark}
                value={textStyle}
              />
              <button
                aria-label={getBgButtonAriaLabel(i18n, textBackground)}
                className={classNames('StoryCreator__tools__tool', {
                  'StoryCreator__tools__button--bg-none':
                    textBackground === TextBackground.None,
                  'StoryCreator__tools__button--bg':
                    textBackground === TextBackground.Background,
                  'StoryCreator__tools__button--bg-inverse':
                    textBackground === TextBackground.Inverse,
                })}
                onClick={() => {
                  if (textBackground === TextBackground.None) {
                    setTextBackground(TextBackground.Background);
                  } else if (textBackground === TextBackground.Background) {
                    setTextBackground(TextBackground.Inverse);
                  } else {
                    setTextBackground(TextBackground.None);
                  }
                }}
                type="button"
              />
            </div>
          ) : (
            <div className="StoryCreator__toolbar--space" />
          )}
          <div className="StoryCreator__toolbar--buttons">
            <Button
              onClick={onClose}
              theme={Theme.Dark}
              variant={ButtonVariant.Secondary}
            >
              {i18n('discard')}
            </Button>
            <div className="StoryCreator__controls">
              <button
                aria-label={i18n('StoryCreator__story-bg')}
                className={classNames({
                  StoryCreator__control: true,
                  'StoryCreator__control--bg': true,
                  'StoryCreator__control--bg--selected': isColorPickerShowing,
                })}
                onClick={() => setIsColorPickerShowing(!isColorPickerShowing)}
                ref={setColorPickerPopperButtonRef}
                style={{
                  background: getBackgroundColor(
                    getBackground(selectedBackground)
                  ),
                }}
                type="button"
              />
              {isColorPickerShowing && (
                <div
                  className="StoryCreator__popper"
                  ref={setColorPickerPopperRef}
                  style={colorPickerPopper.styles.popper}
                  {...colorPickerPopper.attributes.popper}
                >
                  <div
                    data-popper-arrow
                    className="StoryCreator__popper__arrow"
                  />
                  {objectMap<BackgroundStyleType>(
                    BackgroundStyle,
                    (bg, backgroundValue) => (
                      <button
                        aria-label={i18n('StoryCreator__story-bg')}
                        className={classNames({
                          StoryCreator__bg: true,
                          'StoryCreator__bg--selected':
                            selectedBackground === backgroundValue,
                        })}
                        key={String(bg)}
                        onClick={() => {
                          setSelectedBackground(backgroundValue);
                          setIsColorPickerShowing(false);
                        }}
                        type="button"
                        style={{
                          background: getBackgroundColor(
                            getBackground(backgroundValue)
                          ),
                        }}
                      />
                    )
                  )}
                </div>
              )}
              <button
                aria-label={i18n('StoryCreator__control--text')}
                className={classNames({
                  StoryCreator__control: true,
                  'StoryCreator__control--text': true,
                  'StoryCreator__control--selected': isEditingText,
                })}
                onClick={() => {
                  setIsEditingText(!isEditingText);
                }}
                type="button"
              />
              <button
                aria-label={i18n('StoryCreator__control--link')}
                className="StoryCreator__control StoryCreator__control--link"
                onClick={() =>
                  setIsLinkPreviewInputShowing(!isLinkPreviewInputShowing)
                }
                ref={setLinkPreviewInputPopperButtonRef}
                type="button"
              />
              {isLinkPreviewInputShowing && (
                <div
                  className={classNames(
                    'StoryCreator__popper StoryCreator__link-preview-input-popper',
                    themeClassName(Theme.Dark)
                  )}
                  ref={setLinkPreviewInputPopperRef}
                  style={linkPreviewInputPopper.styles.popper}
                  {...linkPreviewInputPopper.attributes.popper}
                >
                  <div
                    data-popper-arrow
                    className="StoryCreator__popper__arrow"
                  />
                  <Input
                    disableSpellcheck
                    i18n={i18n}
                    moduleClassName="StoryCreator__link-preview-input"
                    onChange={setLinkPreviewInputValue}
                    placeholder={i18n('StoryCreator__link-preview-placeholder')}
                    ref={el => el?.focus()}
                    value={linkPreviewInputValue}
                  />
                  <div className="StoryCreator__link-preview-container">
                    {linkPreview ? (
                      <>
                        <StagedLinkPreview
                          domain={linkPreview.domain}
                          i18n={i18n}
                          image={linkPreview.image}
                          moduleClassName="StoryCreator__link-preview"
                          title={linkPreview.title}
                          url={linkPreview.url}
                        />
                        <Button
                          className="StoryCreator__link-preview-button"
                          onClick={() => {
                            setHasLinkPreviewApplied(true);
                            setIsLinkPreviewInputShowing(false);
                          }}
                          theme={Theme.Dark}
                          variant={ButtonVariant.Primary}
                        >
                          {i18n('StoryCreator__add-link')}
                        </Button>
                      </>
                    ) : (
                      <div className="StoryCreator__link-preview-empty">
                        <div className="StoryCreator__link-preview-empty__icon" />
                        {i18n('StoryCreator__link-preview-empty')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <Button
              disabled={!hasChanges}
              onClick={() => onDone(textAttachment)}
              theme={Theme.Dark}
              variant={ButtonVariant.Primary}
            >
              {i18n('StoryCreator__next')}
            </Button>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
};
