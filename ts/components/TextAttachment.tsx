// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Measure from 'react-measure';
import React, { useRef, useState } from 'react';
import classNames from 'classnames';

import type { LocalizerType, RenderTextCallbackType } from '../types/Util';
import type { TextAttachmentType } from '../types/Attachment';
import { AddNewLines } from './conversation/AddNewLines';
import { Emojify } from './conversation/Emojify';
import { TextAttachmentStyleType } from '../types/Attachment';
import { count } from '../util/grapheme';
import { getDomain } from '../types/LinkPreview';
import { getFontNameByTextScript } from '../util/getFontNameByTextScript';
import {
  getHexFromNumber,
  getBackgroundColor,
} from '../util/getStoryBackground';

const renderNewLines: RenderTextCallbackType = ({
  text: textWithNewLines,
  key,
}) => {
  return <AddNewLines key={key} text={textWithNewLines} />;
};

const CHAR_LIMIT_TEXT_LARGE = 50;
const CHAR_LIMIT_TEXT_MEDIUM = 200;
const COLOR_WHITE_INT = 4294704123;
const FONT_SIZE_LARGE = 64;
const FONT_SIZE_MEDIUM = 42;
const FONT_SIZE_SMALL = 32;

enum TextSize {
  Small,
  Medium,
  Large,
}

export type PropsType = {
  i18n: LocalizerType;
  isThumbnail?: boolean;
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

  return `${fontWeight}${fontSize}pt ${fontName}`;
}

export const TextAttachment = ({
  i18n,
  isThumbnail,
  textAttachment,
}: PropsType): JSX.Element | null => {
  const linkPreview = useRef<HTMLDivElement | null>(null);
  const [linkPreviewOffsetTop, setLinkPreviewOffsetTop] = useState<
    number | undefined
  >();

  return (
    <Measure bounds>
      {({ contentRect, measureRef }) => (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div
          className="TextAttachment"
          onClick={() => {
            if (linkPreviewOffsetTop) {
              setLinkPreviewOffsetTop(undefined);
            }
          }}
          onKeyUp={ev => {
            if (ev.key === 'Escape' && linkPreviewOffsetTop) {
              setLinkPreviewOffsetTop(undefined);
            }
          }}
          ref={measureRef}
        >
          <div
            className="TextAttachment__story"
            style={{
              background: getBackgroundColor(textAttachment),
              transform: `scale(${(contentRect.bounds?.height || 1) / 1280})`,
            }}
          >
            {textAttachment.text && (
              <div
                className="TextAttachment__text"
                style={{
                  backgroundColor: textAttachment.textBackgroundColor
                    ? getHexFromNumber(textAttachment.textBackgroundColor)
                    : 'none',
                  color: getHexFromNumber(
                    textAttachment.textForegroundColor || COLOR_WHITE_INT
                  ),
                  font: getFont(
                    textAttachment.text,
                    getTextSize(textAttachment.text),
                    textAttachment.textStyle,
                    i18n
                  ),
                  textAlign:
                    getTextSize(textAttachment.text) === TextSize.Small
                      ? 'left'
                      : 'center',
                }}
              >
                <div className="TextAttachment__text__container">
                  <Emojify
                    text={textAttachment.text}
                    renderNonEmoji={renderNewLines}
                  />
                </div>
              </div>
            )}
            {textAttachment.preview && (
              <>
                {linkPreviewOffsetTop &&
                  !isThumbnail &&
                  textAttachment.preview.url && (
                    <a
                      className="TextAttachment__preview__tooltip"
                      href={textAttachment.preview.url}
                      rel="noreferrer"
                      style={{
                        top: linkPreviewOffsetTop - 150,
                      }}
                      target="_blank"
                    >
                      <div>
                        <div>{i18n('TextAttachment__preview__link')}</div>
                        <div className="TextAttachment__preview__tooltip__url">
                          {textAttachment.preview.url}
                        </div>
                      </div>
                      <div className="TextAttachment__preview__tooltip__arrow" />
                    </a>
                  )}
                <div
                  className={classNames('TextAttachment__preview', {
                    'TextAttachment__preview--large': Boolean(
                      textAttachment.preview.title
                    ),
                  })}
                  ref={linkPreview}
                  onFocus={() =>
                    setLinkPreviewOffsetTop(linkPreview?.current?.offsetTop)
                  }
                  onMouseOver={() =>
                    setLinkPreviewOffsetTop(linkPreview?.current?.offsetTop)
                  }
                >
                  <div className="TextAttachment__preview__image" />
                  <div className="TextAttachment__preview__title">
                    {textAttachment.preview.title && (
                      <div className="TextAttachment__preview__title__container">
                        {textAttachment.preview.title}
                      </div>
                    )}
                    <div className="TextAttachment__preview__url">
                      {getDomain(String(textAttachment.preview.url))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Measure>
  );
};
