// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties, JSX } from 'react';
import classNames from 'classnames';
import type { ConversationColorType } from '../types/Colors.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { formatTime } from '../util/formatTimestamp.dom.ts';
import { getMessageMetadataStatusIconClassName } from './conversation/MessageMetadata.dom.tsx';
import { AxoTokens } from '../axo/AxoTokens.std.ts';

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
    <div
      className={classNames(
        'module-message',
        direction === 'incoming' && 'module-message--incoming',
        direction === 'outgoing' && 'module-message--outgoing'
      )}
    >
      <div className="module-message__container-outer">
        <div
          className={classNames(
            'module-message__container',
            direction === 'incoming' && 'module-message__container--incoming',
            direction === 'outgoing' && 'module-message__container--outgoing'
          )}
          style={{
            ...style,
            ...({
              '--module-message__container-bg':
                AxoTokens.ChatBubble.anyColorNameToCssBackground(color),
            } as CSSProperties),
          }}
        >
          <div
            dir="auto"
            className={classNames(
              'module-message__text',
              direction === 'incoming' && 'module-message__text--incoming',
              direction === 'outgoing' && 'module-message__text--outgoing'
            )}
          >
            <span>{text}</span>
          </div>
          <div
            className={classNames(
              'module-message__metadata',
              direction === 'outgoing' && 'module-message__metadata--outgoing'
            )}
          >
            <span className="module-message__metadata__date">
              {/* oxlint-disable-next-line react/purity */}
              {formatTime(i18n, Date.now() - timestampDeltaFromNow, Date.now())}
            </span>
            {direction === 'outgoing' && (
              <div
                className={classNames(
                  'module-message__metadata__status-icon',
                  getMessageMetadataStatusIconClassName(status)
                )}
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
      <div style={{ clear: 'both' }} />
    </>
  );
}
