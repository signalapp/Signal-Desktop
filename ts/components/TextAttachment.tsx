// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { forwardRef, useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import classNames from 'classnames';

import type { LocalizerType, RenderTextCallbackType } from '../types/Util';
import type { TextAttachmentType } from '../types/Attachment';
import { AddNewLines } from './conversation/AddNewLines';
import { Emojify } from './conversation/Emojify';
import { StoryLinkPreview } from './StoryLinkPreview';
import { TextAttachmentStyleType } from '../types/Attachment';
import { count } from '../util/grapheme';
import { isValidLink, getSafeDomain } from '../types/LinkPreview';
import { getFontNameByTextScript } from '../util/getFontNameByTextScript';
import {
  COLOR_WHITE_INT,
  getHexFromNumber,
  getBackgroundColor,
} from '../util/getStoryBackground';
import { SECOND } from '../util/durations';
import { useRefMerger } from '../hooks/useRefMerger';
import { useSizeObserver } from '../hooks/useSizeObserver';

const renderNewLines: RenderTextCallbackType = ({
  text: textWithNewLines,
  key,
}) => {
  return <AddNewLines key={key} text={textWithNewLines} />;
};

const CHAR_LIMIT_TEXT_LARGE = 50;
const CHAR_LIMIT_TEXT_MEDIUM = 200;
const FONT_SIZE_LARGE = 59;
const FONT_SIZE_MEDIUM = 42;
const FONT_SIZE_SMALL = 32;

enum TextSize {
  Small,
  Medium,
  Large,
}

export type PropsType = {
  disableLinkPreviewPopup?: boolean;
  i18n: LocalizerType;
  isEditingText?: boolean;
  isThumbnail?: boolean;
  onChange?: (text: string) => unknown;
  onClick?: () => unknown;
  onRemoveLinkPreview?: () => unknown;
  textAttachment: TextAttachmentType;
};

function getTextSize(text: string): TextSize {
  const length = count(text);

  if (length < CHAR_LIMIT_TEXT_LARGE) {
    return TextSize.Large;
  }

  if (length < CHAR_LIMIT_TEXT_MEDIUM) {
    return TextSize.Medium;
  }

  return TextSize.Small;
}

function getFont(
  text: string,
  textSize: TextSize,
  textStyle?: TextAttachmentStyleType | null,
  i18n?: LocalizerType
): string {
  const textStyleIndex = Number(textStyle) || 0;
  const fontName = getFontNameByTextScript(text, textStyleIndex, i18n);

  let fontSize = FONT_SIZE_SMALL;
  switch (textSize) {
    case TextSize.Large:
      fontSize = FONT_SIZE_LARGE;
      break;
    case TextSize.Medium:
      fontSize = FONT_SIZE_MEDIUM;
      break;
    default:
      fontSize = FONT_SIZE_SMALL;
  }

  const fontWeight = textStyle === TextAttachmentStyleType.BOLD ? 'bold ' : '';

  return `${fontWeight}${fontSize}px ${fontName}`;
}

function getTextStyles(
  textContent: string,
  textForegroundColor?: number | null,
  textStyle?: TextAttachmentStyleType | null,
  i18n?: LocalizerType
): { color: string; font: string; textAlign: 'left' | 'center' } {
  return {
    color: getHexFromNumber(textForegroundColor || COLOR_WHITE_INT),
    font: getFont(textContent, getTextSize(textContent), textStyle, i18n),
    textAlign: getTextSize(textContent) === TextSize.Small ? 'left' : 'center',
  };
}

export const TextAttachment = forwardRef<HTMLTextAreaElement, PropsType>(
  function TextAttachmentForwarded(
    {
      disableLinkPreviewPopup,
      i18n,
      isEditingText,
      isThumbnail,
      onChange,
      onClick,
      onRemoveLinkPreview,
      textAttachment,
    },
    forwardedTextEditorRef
  ): JSX.Element | null {
    const linkPreview = useRef<HTMLDivElement | null>(null);
    const [linkPreviewOffsetTop, setLinkPreviewOffsetTop] = useState<
      number | undefined
    >();

    const textContent = textAttachment.text || '';
    const textEditorRef = useRef<HTMLTextAreaElement | null>(null);
    const refMerger = useRefMerger();

    useEffect(() => {
      const node = textEditorRef?.current;
      if (!node) {
        return;
      }

      node.focus();
      node.setSelectionRange(node.value.length, node.value.length);
    }, [isEditingText]);

    useEffect(() => {
      setLinkPreviewOffsetTop(undefined);
    }, [textAttachment.preview?.url]);

    const [isHoveringOverTooltip, setIsHoveringOverTooltip] = useState(false);

    function showTooltip() {
      if (disableLinkPreviewPopup) {
        return;
      }
      setIsHoveringOverTooltip(true);
      setLinkPreviewOffsetTop(linkPreview?.current?.offsetTop);
    }

    useEffect(() => {
      const timeout = setTimeout(() => {
        if (!isHoveringOverTooltip) {
          setLinkPreviewOffsetTop(undefined);
        }
      }, 5 * SECOND);

      return () => {
        clearTimeout(timeout);
      };
    }, [isHoveringOverTooltip]);

    const storyBackgroundColor = {
      background: getBackgroundColor(textAttachment),
    };

    const ref = useRef<HTMLDivElement>(null);
    const size = useSizeObserver(ref);

    const scaleFactor = (size?.height || 1) / 1280;

    return (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <div
        className="TextAttachment"
        onClick={() => {
          if (linkPreviewOffsetTop) {
            setLinkPreviewOffsetTop(undefined);
          }
          onClick?.();
        }}
        onKeyUp={ev => {
          if (ev.key === 'Escape' && linkPreviewOffsetTop) {
            setLinkPreviewOffsetTop(undefined);
          }
        }}
        ref={ref}
        style={isThumbnail ? storyBackgroundColor : undefined}
      >
        {/*
            The tooltip must be outside of the scaled area, as it should not scale with
            the story, but it must be positioned using the scaled offset
            */}
        {textAttachment.preview &&
          isValidLink(textAttachment.preview.url) &&
          linkPreviewOffsetTop &&
          !isThumbnail && (
            <a
              className="TextAttachment__preview__tooltip"
              href={textAttachment.preview.url}
              rel="noreferrer"
              style={{
                top: linkPreviewOffsetTop * scaleFactor - 89, // minus height of tooltip and some spacing
              }}
              target="_blank"
            >
              <div>
                <div className="TextAttachment__preview__tooltip__title">
                  {i18n('icu:TextAttachment__preview__link')}
                </div>
                <div className="TextAttachment__preview__tooltip__url">
                  {textAttachment.preview.url}
                </div>
              </div>
              <div className="TextAttachment__preview__tooltip__arrow" />
            </a>
          )}
        <div
          className="TextAttachment__story"
          style={{
            ...(isThumbnail ? {} : storyBackgroundColor),
            transform: `scale(${scaleFactor})`,
          }}
        >
          {(textContent || onChange) && (
            <div
              className={classNames('TextAttachment__text', {
                'TextAttachment__text--with-bg': Boolean(
                  textAttachment.textBackgroundColor
                ),
              })}
              style={{
                backgroundColor: textAttachment.textBackgroundColor
                  ? getHexFromNumber(textAttachment.textBackgroundColor)
                  : 'transparent',
              }}
            >
              {onChange ? (
                <TextareaAutosize
                  dir="auto"
                  className="TextAttachment__text__container TextAttachment__text__textarea"
                  disabled={!isEditingText}
                  onChange={ev => onChange(ev.currentTarget.value)}
                  placeholder={i18n('icu:TextAttachment__placeholder')}
                  ref={refMerger(forwardedTextEditorRef, textEditorRef)}
                  style={getTextStyles(
                    textContent,
                    textAttachment.textForegroundColor,
                    textAttachment.textStyle,
                    i18n
                  )}
                  value={textContent}
                />
              ) : (
                <div
                  className="TextAttachment__text__container"
                  style={getTextStyles(
                    textContent,
                    textAttachment.textForegroundColor,
                    textAttachment.textStyle,
                    i18n
                  )}
                >
                  <Emojify text={textContent} renderNonEmoji={renderNewLines} />
                </div>
              )}
            </div>
          )}
          {textAttachment.preview && textAttachment.preview.url && (
            <div
              className={classNames('TextAttachment__preview-container', {
                'TextAttachment__preview-container--large': Boolean(
                  textAttachment.preview.title
                ),
              })}
              ref={linkPreview}
              onBlur={() => setIsHoveringOverTooltip(false)}
              onFocus={showTooltip}
              onMouseOut={() => setIsHoveringOverTooltip(false)}
              onMouseOver={showTooltip}
            >
              {onRemoveLinkPreview && (
                <div className="TextAttachment__preview__remove">
                  <button
                    aria-label={i18n('icu:Keyboard--remove-draft-link-preview')}
                    type="button"
                    onClick={onRemoveLinkPreview}
                  />
                </div>
              )}
              <StoryLinkPreview
                {...textAttachment.preview}
                domain={getSafeDomain(String(textAttachment.preview.url))}
                forceCompactMode={getTextSize(textContent) !== TextSize.Large}
                i18n={i18n}
                title={textAttachment.preview.title || undefined}
                url={textAttachment.preview.url}
              />
            </div>
          )}
        </div>
      </div>
    );
  }
);
