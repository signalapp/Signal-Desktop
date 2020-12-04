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
          theme={theme}
        />
      ) : null}
      <MetadataSpacer />
      {bodyPending ? <Spinner size="mini" direction={direction} /> : null}
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
