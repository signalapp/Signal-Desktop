import React from 'react';
import classNames from 'classnames';

import {
  MessageSendingErrorText,
  MetadataSpacer,
} from './MetadataUtilComponent';
import { OutgoingMessageStatus } from './OutgoingMessageStatus';
import { Spinner } from '../../Spinner';
import { MetadataBadges } from './MetadataBadge';
import { Timestamp } from '../Timestamp';
import { ExpireTimer } from '../ExpireTimer';
import styled, { DefaultTheme } from 'styled-components';

type Props = {
  disableMenu?: boolean;
  isAdmin?: boolean;
  isDeletable: boolean;
  text?: string;
  id: string;
  collapseMetadata?: boolean;
  direction: 'incoming' | 'outgoing';
  timestamp: number;
  serverTimestamp?: number;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  expirationLength?: number;
  expirationTimestamp?: number;
  isPublic?: boolean;
  isShowingImage: boolean;
  theme: DefaultTheme;
};
// for some reason, we have to extend a styled component as this:
// props => <OpacityMetadataComponent {...props}/>
export const OpacityMetadataComponent = styled.div<{ theme: DefaultTheme }>`
  opacity: 0.5;
  transition: ${props => props.theme.common.animations.defaultDuration};
  &:hover {
    opacity: 1;
  }
`;

const handleImageNoCaption = (props: { withImageNoCaption: boolean }) => {
  if (props.withImageNoCaption) {
    return 'position: absolute; bottom: 9px; z-index: 2; width: 100%; padding-inline-end: 24px;';
  }
  return '';
};

// tslint:disable no-unnecessary-callback-wrapper
const MetadatasContainer = styled.div<{ withImageNoCaption: boolean }>`
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: 5px;
  margin-bottom: -3px;
  ${props => handleImageNoCaption(props)}
`;

/**
 * This is a component to display the message of an Incoming or Outgoing message.
 */
export const MessageMetadata = (props: Props) => {
  const {
    id,
    collapseMetadata,
    direction,
    expirationLength,
    expirationTimestamp,
    status,
    text,
    timestamp,
    serverTimestamp,
    isShowingImage,
    isPublic,
    isAdmin,
    theme,
  } = props;

  if (collapseMetadata) {
    return null;
  }
  const isOutgoing = direction === 'outgoing';

  const withImageNoCaption = Boolean(!text && isShowingImage);
  const showError = status === 'error' && isOutgoing;

  const showStatus = Boolean(status?.length && isOutgoing);
  const messageStatusColor = withImageNoCaption
    ? 'white'
    : props.theme.colors.sentMessageText;
  return (
    <MetadatasContainer withImageNoCaption={withImageNoCaption} {...props}>
      {showError ? (
        <MessageSendingErrorText
          withImageNoCaption={withImageNoCaption}
          theme={theme}
        />
      ) : (
        <Timestamp
          timestamp={serverTimestamp || timestamp}
          extended={true}
          withImageNoCaption={withImageNoCaption}
          isConversationListItem={false}
          theme={theme}
        />
      )}
      <MetadataBadges
        direction={direction}
        isPublic={isPublic}
        isAdmin={isAdmin}
        id={id}
        withImageNoCaption={withImageNoCaption}
      />

      {expirationLength && expirationTimestamp ? (
        <ExpireTimer
          direction={direction}
          expirationLength={expirationLength}
          expirationTimestamp={expirationTimestamp}
          withImageNoCaption={withImageNoCaption}
          theme={theme}
        />
      ) : null}
      <MetadataSpacer />
      {showStatus ? (
        <OutgoingMessageStatus
          iconColor={messageStatusColor}
          theme={theme}
          status={status}
          // do not show the error status, another component is shown on the right of the message itself here
          isInMessageView={true}
        />
      ) : null}
    </MetadatasContainer>
  );
};
