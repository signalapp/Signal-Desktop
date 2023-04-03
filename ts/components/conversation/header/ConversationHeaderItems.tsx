import React, { KeyboardEvent } from 'react';
import { contextMenu, TriggerEvent } from 'react-contexify';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { useIsRequest } from '../../../hooks/useParamSelector';
import { callRecipient } from '../../../interactions/conversationInteractions';
import { getHasIncomingCall, getHasOngoingCall } from '../../../state/selectors/call';
import {
  getIsSelectedActive,
  getIsSelectedBlocked,
  getIsSelectedNoteToSelf,
  getIsSelectedPrivate,
  getSelectedConversationKey,
} from '../../../state/selectors/conversations';
import { Avatar, AvatarSize } from '../../avatar/Avatar';
import { SessionIconButton } from '../../icon';

const TripleDotContainer = styled.div`
  user-select: none;
  flex-grow: 0;
  flex-shrink: 0;
`;

export const TripleDotsMenu = (props: { triggerId: string; showBackButton: boolean }) => {
  const { showBackButton } = props;
  if (showBackButton) {
    return null;
  }

  const handleOnClick = (e: TriggerEvent) => {
    contextMenu.show({
      id: props.triggerId,
      event: e,
    });
  };

  const handleOnKeyPress = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      handleOnClick(e);
    }
  };

  return (
    <TripleDotContainer
      role="button"
      onKeyPress={handleOnKeyPress}
      onClick={handleOnClick}
      tabIndex={0}
      data-testid="three-dots-conversation-options"
    >
      <SessionIconButton iconType="ellipses" iconSize="medium" />
    </TripleDotContainer>
  );
};

export const AvatarHeader = (props: {
  pubkey: string;
  showBackButton: boolean;
  onAvatarClick?: (pubkey: string) => void;
}) => {
  const { pubkey, onAvatarClick, showBackButton } = props;

  return (
    <span className="module-conversation-header__avatar">
      <Avatar
        size={AvatarSize.S}
        onAvatarClick={() => {
          // do not allow right panel to appear if another button is shown on the SessionConversation
          if (onAvatarClick && !showBackButton) {
            onAvatarClick(pubkey);
          }
        }}
        pubkey={pubkey}
        dataTestId="conversation-options-avatar"
      />
    </span>
  );
};

export const BackButton = (props: { onGoBack: () => void; showBackButton: boolean }) => {
  const { onGoBack, showBackButton } = props;
  if (!showBackButton) {
    return null;
  }

  return (
    <SessionIconButton
      iconType="chevron"
      iconSize="large"
      iconRotation={90}
      onClick={onGoBack}
      dataTestId="back-button-message-details"
    />
  );
};

export const CallButton = () => {
  const isPrivate = useSelector(getIsSelectedPrivate);
  const isBlocked = useSelector(getIsSelectedBlocked);
  const activeAt = useSelector(getIsSelectedActive);
  const isMe = useSelector(getIsSelectedNoteToSelf);
  const selectedConvoKey = useSelector(getSelectedConversationKey);

  const hasIncomingCall = useSelector(getHasIncomingCall);
  const hasOngoingCall = useSelector(getHasOngoingCall);
  const canCall = !(hasIncomingCall || hasOngoingCall);

  const isRequest = useIsRequest(selectedConvoKey);

  if (!isPrivate || isMe || !selectedConvoKey || isBlocked || !activeAt || isRequest) {
    return null;
  }

  return (
    <SessionIconButton
      iconType="phone"
      iconSize="large"
      iconPadding="2px"
      // negative margin to keep conversation header title centered
      margin="0 10px 0 -32px"
      onClick={() => {
        void callRecipient(selectedConvoKey, canCall);
      }}
    />
  );
};
