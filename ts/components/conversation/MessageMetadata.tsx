// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent, ReactChild } from 'react';
import React from 'react';
import classNames from 'classnames';

import type { LocalizerType } from '../../types/Util';
import type { DirectionType, MessageStatusType } from './Message';
import { ExpireTimer } from './ExpireTimer';
import { Timestamp } from './Timestamp';
import { Spinner } from '../Spinner';

type PropsType = {
  deletedForEveryone?: boolean;
  direction: DirectionType;
  expirationLength?: number;
  expirationTimestamp?: number;
  hasText: boolean;
  i18n: LocalizerType;
  id: string;
  isShowingImage: boolean;
  isSticker?: boolean;
  isTapToViewExpired?: boolean;
  showMessageDetail: (id: string) => void;
  status?: MessageStatusType;
  textPending?: boolean;
  timestamp: number;
};

export const MessageMetadata: FunctionComponent<PropsType> = props => {
  const {
    deletedForEveryone,
    direction,
    expirationLength,
    expirationTimestamp,
    hasText,
    i18n,
    id,
    isShowingImage,
    isSticker,
    isTapToViewExpired,
    showMessageDetail,
    status,
    textPending,
    timestamp,
  } = props;

  const withImageNoCaption = Boolean(!isSticker && !hasText && isShowingImage);
  const metadataDirection = isSticker ? undefined : direction;

  let timestampNode: ReactChild;
  {
    const isError = status === 'error' && direction === 'outgoing';
    const isPartiallySent =
      status === 'partial-sent' && direction === 'outgoing';
    const isPaused = status === 'paused';

    if (isError || isPartiallySent || isPaused) {
      let statusInfo: React.ReactChild;
      if (isError) {
        statusInfo = i18n('sendFailed');
      } else if (isPaused) {
        statusInfo = i18n('sendPaused');
      } else {
        statusInfo = (
          <button
            type="button"
            className="module-message__metadata__tapable"
            onClick={(event: React.MouseEvent) => {
              event.stopPropagation();
              event.preventDefault();

              showMessageDetail(id);
            }}
          >
            {i18n('partiallySent')}
          </button>
        );
      }

      timestampNode = (
        <span
          className={classNames({
            'module-message__metadata__date': true,
            'module-message__metadata__date--with-sticker': isSticker,
            [`module-message__metadata__date--${direction}`]: !isSticker,
            'module-message__metadata__date--with-image-no-caption':
              withImageNoCaption,
          })}
        >
          {statusInfo}
        </span>
      );
    } else {
      timestampNode = (
        <Timestamp
          i18n={i18n}
          timestamp={timestamp}
          extended
          direction={metadataDirection}
          withImageNoCaption={withImageNoCaption}
          withSticker={isSticker}
          withTapToViewExpired={isTapToViewExpired}
          module="module-message__metadata__date"
        />
      );
    }
  }

  return (
    <div
      className={classNames(
        'module-message__metadata',
        `module-message__metadata--${direction}`,
        withImageNoCaption
          ? 'module-message__metadata--with-image-no-caption'
          : null
      )}
    >
      {timestampNode}
      {expirationLength && expirationTimestamp ? (
        <ExpireTimer
          direction={metadataDirection}
          expirationLength={expirationLength}
          expirationTimestamp={expirationTimestamp}
          withImageNoCaption={withImageNoCaption}
          withSticker={isSticker}
          withTapToViewExpired={isTapToViewExpired}
        />
      ) : null}
      {textPending ? (
        <div className="module-message__metadata__spinner-container">
          <Spinner svgSize="small" size="14px" direction={direction} />
        </div>
      ) : null}
      {!deletedForEveryone &&
      !textPending &&
      direction === 'outgoing' &&
      status !== 'error' &&
      status !== 'partial-sent' ? (
        <div
          className={classNames(
            'module-message__metadata__status-icon',
            `module-message__metadata__status-icon--${status}`,
            isSticker
              ? 'module-message__metadata__status-icon--with-sticker'
              : null,
            withImageNoCaption
              ? 'module-message__metadata__status-icon--with-image-no-caption'
              : null,
            isTapToViewExpired
              ? 'module-message__metadata__status-icon--with-tap-to-view-expired'
              : null
          )}
        />
      ) : null}
    </div>
  );
};
