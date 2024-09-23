// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { KeyboardEvent } from 'react';
import React from 'react';

import type { AttachmentType } from '../../types/Attachment';
import { canBeDownloaded, isDownloaded } from '../../types/Attachment';
import { getSizeClass } from '../emoji/lib';

import type { ShowConversationType } from '../../state/ducks/conversations';
import type { HydratedBodyRangesType } from '../../types/BodyRange';
import type { LocalizerType } from '../../types/Util';
import { MessageTextRenderer } from './MessageTextRenderer';
import type { RenderLocation } from './MessageTextRenderer';
import { UserText } from '../UserText';
import { shouldLinkifyMessage } from '../../types/LinkPreview';

export type Props = {
  author?: string;
  bodyRanges?: HydratedBodyRangesType;
  direction?: 'incoming' | 'outgoing';
  // If set, all emoji will be the same size. Otherwise, just one emoji will be large.
  disableJumbomoji?: boolean;
  // If set, interactive elements will be left as plain text: links, mentions, spoilers
  disableLinks?: boolean;
  i18n: LocalizerType;
  isSpoilerExpanded: Record<string, boolean>;
  kickOffBodyDownload?: () => void;
  onExpandSpoiler?: (data: Record<number, boolean>) => unknown;
  onIncreaseTextLength?: () => unknown;
  prefix?: string;
  renderLocation: RenderLocation;
  showConversation?: ShowConversationType;
  text: string;
  textAttachment?: Pick<
    AttachmentType,
    'pending' | 'digest' | 'key' | 'wasTooBig' | 'path'
  >;
};

/**
 * This component makes it very easy to use all three of our message formatting
 * components: `Emojify`, `Linkify`, and `AddNewLines`. Because each of them is fully
 * configurable with their `renderXXX` props, this component will assemble all three of
 * them for you.
 */
export function MessageBody({
  author,
  bodyRanges,
  direction,
  disableJumbomoji,
  disableLinks,
  i18n,
  isSpoilerExpanded,
  kickOffBodyDownload,
  onExpandSpoiler,
  onIncreaseTextLength,
  prefix,
  renderLocation,
  showConversation,
  text,
  textAttachment,
}: Props): JSX.Element {
  const shouldDisableLinks = disableLinks || !shouldLinkifyMessage(text);
  const textWithSuffix =
    textAttachment?.pending || onIncreaseTextLength || textAttachment?.wasTooBig
      ? `${text}...`
      : text;

  const sizeClass = disableJumbomoji ? undefined : getSizeClass(text);

  let endNotification: React.ReactNode;
  if (onIncreaseTextLength) {
    endNotification = (
      <button
        className="MessageBody__read-more"
        onClick={() => {
          onIncreaseTextLength();
        }}
        onKeyDown={(ev: KeyboardEvent) => {
          if (ev.key === 'Space' || ev.key === 'Enter') {
            onIncreaseTextLength();
          }
        }}
        tabIndex={0}
        type="button"
      >
        {' '}
        {i18n('icu:MessageBody--read-more')}
      </button>
    );
  } else if (textAttachment?.pending) {
    endNotification = (
      <span className="MessageBody__highlight"> {i18n('icu:downloading')}</span>
    );
  } else if (
    textAttachment &&
    canBeDownloaded(textAttachment) &&
    !isDownloaded(textAttachment) &&
    kickOffBodyDownload
  ) {
    endNotification = (
      <span>
        {' '}
        <button
          className="MessageBody__download-body"
          onClick={() => {
            kickOffBodyDownload();
          }}
          onKeyDown={(ev: KeyboardEvent) => {
            if (ev.key === 'Space' || ev.key === 'Enter') {
              kickOffBodyDownload();
            }
          }}
          tabIndex={0}
          type="button"
        >
          {i18n('icu:downloadFullMessage')}
        </button>
      </span>
    );
  } else if (textAttachment?.wasTooBig) {
    endNotification = (
      <span className="MessageBody__message-too-long">
        {' '}
        {i18n('icu:MessageBody--message-too-long')}
      </span>
    );
  }
  return (
    <span>
      {author && (
        <>
          <span className="MessageBody__author">
            <UserText text={author} />
          </span>
          :{' '}
        </>
      )}
      {prefix && (
        <>
          <span className="MessageBody__prefix">
            <UserText text={prefix} />
          </span>{' '}
        </>
      )}

      <MessageTextRenderer
        bodyRanges={bodyRanges ?? []}
        direction={direction}
        disableLinks={shouldDisableLinks}
        emojiSizeClass={sizeClass}
        i18n={i18n}
        isSpoilerExpanded={isSpoilerExpanded}
        messageText={textWithSuffix}
        onMentionTrigger={conversationId =>
          showConversation?.({ conversationId })
        }
        onExpandSpoiler={onExpandSpoiler}
        renderLocation={renderLocation}
        textLength={text.length}
      />

      {endNotification}
    </span>
  );
}
