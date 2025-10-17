// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties } from 'react';
import React from 'react';
import type { ConversationColorType } from '../types/Colors.std.js';
import type { LocalizerType } from '../types/Util.std.js';
import { formatTime } from '../util/formatTimestamp.dom.js';

export type PropsType = {
  backgroundStyle?: CSSProperties;
  color?: ConversationColorType;
  i18n: LocalizerType;
  includeAnotherBubble?: boolean;
};

const A_FEW_DAYS_AGO = 60 * 60 * 24 * 5 * 1000;

function SampleMessage({
  color = 'ultramarine',
  direction,
  i18n,
  text,
  timestampDeltaFromNow,
  status,
  style,
}: {
  color?: ConversationColorType;
  direction: 'incoming' | 'outgoing';
  i18n: LocalizerType;
  text: string;
  timestampDeltaFromNow: number;
  status: 'delivered' | 'read' | 'sent';
  style?: CSSProperties;
}): JSX.Element {
  return (
    <div className={`module-message module-message--${direction}`}>
      <div className="module-message__container-outer">
        <div
          className={`module-message__container module-message__container--${direction} module-message__container--${direction}-${color}`}
          style={style}
        >
          <div
            dir="auto"
            className={`module-message__text module-message__text--${direction}`}
          >
            <span>{text}</span>
          </div>
          <div
            className={`module-message__metadata module-message__metadata--${direction}`}
          >
            <span
              className={`module-message__metadata__date module-message__metadata__date--${direction}`}
            >
              {formatTime(i18n, Date.now() - timestampDeltaFromNow, Date.now())}
            </span>
            {direction === 'outgoing' && (
              <div
                className={`module-message__metadata__status-icon module-message__metadata__status-icon--${status}`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SampleMessageBubbles({
  backgroundStyle = {},
  color,
  i18n,
  includeAnotherBubble = false,
}: PropsType): JSX.Element {
  const firstBubbleStyle = includeAnotherBubble ? backgroundStyle : undefined;
  return (
    <>
      <SampleMessage
        color={color}
        direction={includeAnotherBubble ? 'outgoing' : 'incoming'}
        i18n={i18n}
        text={i18n('icu:ChatColorPicker__sampleBubble1')}
        timestampDeltaFromNow={A_FEW_DAYS_AGO}
        status="read"
        style={firstBubbleStyle}
      />
      <br />
      {includeAnotherBubble ? (
        <>
          <br style={{ clear: 'both' }} />
          <br />
          <SampleMessage
            direction="incoming"
            i18n={i18n}
            text={i18n('icu:ChatColorPicker__sampleBubble2')}
            timestampDeltaFromNow={A_FEW_DAYS_AGO / 2}
            status="read"
          />
          <br />
          <br />
        </>
      ) : null}
      <SampleMessage
        color={color}
        direction="outgoing"
        i18n={i18n}
        text={i18n('icu:ChatColorPicker__sampleBubble3')}
        timestampDeltaFromNow={0}
        status="delivered"
        style={backgroundStyle}
      />
      <br style={{ clear: 'both' }} />
    </>
  );
}
