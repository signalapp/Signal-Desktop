// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties } from 'react';
import React from 'react';
import type { ConversationColorType } from '../types/Colors';
import type { LocalizerType } from '../types/Util';
import { formatRelativeTime } from '../util/formatRelativeTime';

export type PropsType = {
  backgroundStyle?: CSSProperties;
  color?: ConversationColorType;
  i18n: LocalizerType;
  includeAnotherBubble?: boolean;
};

const A_FEW_DAYS_AGO = 60 * 60 * 24 * 5 * 1000;

const SampleMessage = ({
  color = 'ultramarine',
  direction,
  i18n,
  text,
  timestamp,
  status,
  style,
}: {
  color?: ConversationColorType;
  direction: 'incoming' | 'outgoing';
  i18n: LocalizerType;
  text: string;
  timestamp: number;
  status: 'delivered' | 'read' | 'sent';
  style?: CSSProperties;
}): JSX.Element => (
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
            {formatRelativeTime(timestamp, { extended: true, i18n })}
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

export const SampleMessageBubbles = ({
  backgroundStyle = {},
  color,
  i18n,
  includeAnotherBubble = false,
}: PropsType): JSX.Element => {
  const firstBubbleStyle = includeAnotherBubble ? backgroundStyle : undefined;
  return (
    <>
      <SampleMessage
        color={color}
        direction={includeAnotherBubble ? 'outgoing' : 'incoming'}
        i18n={i18n}
        text={i18n('ChatColorPicker__sampleBubble1')}
        timestamp={Date.now() - A_FEW_DAYS_AGO}
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
            text={i18n('ChatColorPicker__sampleBubble2')}
            timestamp={Date.now() - A_FEW_DAYS_AGO / 2}
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
        text={i18n('ChatColorPicker__sampleBubble3')}
        timestamp={Date.now()}
        status="delivered"
        style={backgroundStyle}
      />
      <br style={{ clear: 'both' }} />
    </>
  );
};
