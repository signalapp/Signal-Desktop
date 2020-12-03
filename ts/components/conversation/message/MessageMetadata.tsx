import React from 'react';
import classNames from 'classnames';

import { MetadataSpacer } from './MetadataUtilComponent';
import { OutgoingMessageStatus } from './OutgoingMessageStatus';
import { Spinner } from '../../Spinner';
import { MetadataBadges } from './MetadataBadge';
import { Timestamp } from '../Timestamp';
import { ExpireTimer } from '../ExpireTimer';
import { DefaultTheme } from 'styled-components';

type Props = {
  disableMenu?: boolean;
  isModerator?: boolean;
  isDeletable: boolean;
  text?: string;
  bodyPending?: boolean;
  id: string;
  collapseMetadata?: boolean;
  direction: 'incoming' | 'outgoing';
  timestamp: number;
  serverTimestamp?: number;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'error' | 'pow';
  expirationLength?: number;
  expirationTimestamp?: number;
  isPublic?: boolean;
  isShowingImage: boolean;
  theme: DefaultTheme;
};

export const MessageMetadata = (props: Props) => {
  const {
    id,
    collapseMetadata,
    direction,
    expirationLength,
    expirationTimestamp,
    status,
    text,
    bodyPending,
    timestamp,
    serverTimestamp,
    isShowingImage,
    isPublic,
    isModerator,
    theme,
  } = props;

  if (collapseMetadata) {
    return null;
  }
  const isOutgoing = direction === 'outgoing';

  const withImageNoCaption = Boolean(!text && isShowingImage);
  const showError = status === 'error' && isOutgoing;

  const showStatus = Boolean(!bodyPending && status?.length && isOutgoing);
  return (
    <div
      className={classNames(
        'module-message__metadata',
        withImageNoCaption
          ? 'module-message__metadata--with-image-no-caption'
          : null
      )}
    >
      {showError ? (
        <span
          className={classNames(
            'module-message__metadata__date',
            `module-message__metadata__date--${direction}`,
            withImageNoCaption
              ? 'module-message__metadata__date--with-image-no-caption'
              : null
          )}
        >
          {window.i18n('sendFailed')}
        </span>
      ) : (
        <Timestamp
          timestamp={serverTimestamp || timestamp}
          extended={true}
          direction={direction}
          withImageNoCaption={withImageNoCaption}
          module="module-message__metadata__date"
        />
      )}
      <MetadataBadges
        direction={direction}
        isPublic={isPublic}
        isModerator={isModerator}
        id={id}
        withImageNoCaption={withImageNoCaption}
      />

      {expirationLength && expirationTimestamp ? (
        <ExpireTimer
          direction={direction}
          expirationLength={expirationLength}
          expirationTimestamp={expirationTimestamp}
          withImageNoCaption={withImageNoCaption}
        />
      ) : null}
      <MetadataSpacer />
      {bodyPending ? <Spinner size="mini" direction={direction} /> : null}
      <MetadataSpacer />
      {showStatus ? (
        <OutgoingMessageStatus
          withImageNoCaption={withImageNoCaption}
          theme={theme}
          status={status}
        />
      ) : null}
    </div>
  );
};
