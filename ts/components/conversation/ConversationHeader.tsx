import React from 'react';

import { Avatar, AvatarSize } from '../avatar/Avatar';

import { contextMenu } from 'react-contexify';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { ConversationNotificationSettingType } from '../../models/conversationAttributes';
import {
  getSelectedMessageIds,
  isMessageDetailView,
  isMessageSelectionMode,
  isRightPanelShowing,
} from '../../state/selectors/conversations';

import {
  useConversationUsername,
  useExpireTimer,
  useIsKickedFromGroup,
} from '../../hooks/useParamSelector';
import { callRecipient } from '../../interactions/conversationInteractions';
import {
  deleteMessagesById,
  deleteMessagesByIdForEveryone,
} from '../../interactions/conversations/unsendingInteractions';
import {
  closeMessageDetailsView,
  closeRightPanel,
  openRightPanel,
  resetSelectedMessageIds,
} from '../../state/ducks/conversations';
import { getHasIncomingCall, getHasOngoingCall } from '../../state/selectors/call';
import {
  useSelectedConversationKey,
  useSelectedIsActive,
  useSelectedIsBlocked,
  useSelectedIsPrivateFriend,
  useSelectedIsGroup,
  useSelectedIsKickedFromGroup,
  useSelectedIsPrivate,
  useSelectedIsPublic,
  useSelectedMembers,
  useSelectedNotificationSetting,
  useSelectedSubscriberCount,
  useSelectedisNoteToSelf,
} from '../../state/selectors/selectedConversation';
import { ExpirationTimerOptions } from '../../util/expiringMessages';
import { Flex } from '../basic/Flex';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonShape,
  SessionButtonType,
} from '../basic/SessionButton';
import { SessionIconButton } from '../icon';
import { ConversationHeaderMenu } from '../menu/ConversationHeaderMenu';

export interface TimerOption {
  name: string;
  value: number;
}

const SelectionOverlay = () => {
  const selectedMessageIds = useSelector(getSelectedMessageIds);
  const selectedConversationKey = useSelectedConversationKey();
  const isPublic = useSelectedIsPublic();
  const dispatch = useDispatch();

  const { i18n } = window;

  function onCloseOverlay() {
    dispatch(resetSelectedMessageIds());
  }

  function onDeleteSelectedMessages() {
    if (selectedConversationKey) {
      void deleteMessagesById(selectedMessageIds, selectedConversationKey);
    }
  }
  function onDeleteSelectedMessagesForEveryone() {
    if (selectedConversationKey) {
      void deleteMessagesByIdForEveryone(selectedMessageIds, selectedConversationKey);
    }
  }

  const isOnlyServerDeletable = isPublic;
  const deleteMessageButtonText = i18n('delete');
  const deleteForEveryoneMessageButtonText = i18n('deleteForEveryone');

  return (
    <div className="message-selection-overlay">
      <div className="close-button">
        <SessionIconButton iconType="exit" iconSize="medium" onClick={onCloseOverlay} />
      </div>

      <div className="button-group">
        {!isOnlyServerDeletable && (
          <SessionButton
            buttonColor={SessionButtonColor.Danger}
            buttonShape={SessionButtonShape.Square}
            buttonType={SessionButtonType.Solid}
            text={deleteMessageButtonText}
            onClick={onDeleteSelectedMessages}
          />
        )}
        <SessionButton
          buttonColor={SessionButtonColor.Danger}
          buttonShape={SessionButtonShape.Square}
          buttonType={SessionButtonType.Solid}
          text={deleteForEveryoneMessageButtonText}
          onClick={onDeleteSelectedMessagesForEveryone}
        />
      </div>
    </div>
  );
};

const TripleDotContainer = styled.div`
  user-select: none;
  flex-grow: 0;
  flex-shrink: 0;
`;

const TripleDotsMenu = (props: { triggerId: string; showBackButton: boolean }) => {
  const { showBackButton } = props;

  const isPrivateFriend = useSelectedIsPrivateFriend();
  const isPrivate = useSelectedIsPrivate();
  if (showBackButton) {
    return null;
  }
  if (isPrivate && !isPrivateFriend) {
    return null;
  }
  return (
    <TripleDotContainer
      role="button"
      onClick={(e: any) => {
        contextMenu.show({
          id: props.triggerId,
          event: e,
        });
      }}
      data-testid="three-dots-conversation-options"
    >
      <SessionIconButton iconType="ellipses" iconSize="medium" />
    </TripleDotContainer>
  );
};

const ExpirationLength = (props: { expirationSettingName?: string }) => {
  const { expirationSettingName } = props;

  if (!expirationSettingName) {
    return null;
  }

  return (
    <div className="module-conversation-header__expiration">
      <div className="module-conversation-header__expiration__clock-icon" />
      <div
        className="module-conversation-header__expiration__setting"
        data-testid="disappearing-messages-indicator"
      >
        {expirationSettingName}
      </div>
    </div>
  );
};

const AvatarHeader = (props: {
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

const BackButton = (props: { onGoBack: () => void; showBackButton: boolean }) => {
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

const CallButton = () => {
  const isPrivate = useSelectedIsPrivate();
  const isBlocked = useSelectedIsBlocked();
  const isActive = useSelectedIsActive();
  const isMe = useSelectedisNoteToSelf();
  const selectedConvoKey = useSelectedConversationKey();

  const hasIncomingCall = useSelector(getHasIncomingCall);
  const hasOngoingCall = useSelector(getHasOngoingCall);
  const canCall = !(hasIncomingCall || hasOngoingCall);

  const isPrivateFriend = useSelectedIsPrivateFriend();

  if (
    !isPrivate ||
    isMe ||
    !selectedConvoKey ||
    isBlocked ||
    !isActive ||
    !isPrivateFriend // call requires us to be friends
  ) {
    return null;
  }

  return (
    <SessionIconButton
      iconType="phone"
      iconSize="large"
      iconPadding="2px"
      margin="0 10px 0 0"
      onClick={() => {
        void callRecipient(selectedConvoKey, canCall);
      }}
    />
  );
};

export const StyledSubtitleContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  span:last-child {
    margin-bottom: 0;
  }
`;

export type ConversationHeaderTitleProps = {
  conversationKey: string;
  isMe: boolean;
  isGroup: boolean;
  isPublic: boolean;
  members: Array<any>;
  isKickedFromGroup: boolean;
  currentNotificationSetting?: ConversationNotificationSettingType;
};

/**
 * The subtitle beneath a conversation title when looking at a conversation screen.
 * @param props props for subtitle. Text to be displayed
 * @returns JSX Element of the subtitle of conversation header
 */
export const ConversationHeaderSubtitle = (props: { text?: string | null }): JSX.Element | null => {
  const { text } = props;
  if (!text) {
    return null;
  }
  return <span className="module-conversation-header__title-text">{text}</span>;
};

const ConversationHeaderTitle = () => {
  const dispatch = useDispatch();

  const notificationSetting = useSelectedNotificationSetting();
  const isRightPanelOn = useSelector(isRightPanelShowing);
  const subscriberCount = useSelectedSubscriberCount();
  const selectedConvoKey = useSelectedConversationKey();
  const convoName = useConversationUsername(selectedConvoKey);

  const isPublic = useSelectedIsPublic();
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const isMe = useSelectedisNoteToSelf();
  const isGroup = useSelectedIsGroup();
  const members = useSelectedMembers();

  if (!selectedConvoKey) {
    return null;
  }

  const { i18n } = window;

  if (isMe) {
    return <div className="module-conversation-header__title">{i18n('noteToSelf')}</div>;
  }

  let memberCount = 0;
  if (isGroup) {
    if (isPublic) {
      memberCount = subscriberCount || 0;
    } else {
      memberCount = members.length;
    }
  }

  let memberCountText = '';
  if (isGroup && memberCount > 0 && !isKickedFromGroup) {
    const count = String(memberCount);
    memberCountText = isPublic ? i18n('activeMembers', [count]) : i18n('members', [count]);
  }

  const notificationSubtitle = notificationSetting
    ? window.i18n('notificationSubtitle', [notificationSetting])
    : null;
  const fullTextSubtitle = memberCountText
    ? `${memberCountText} ● ${notificationSubtitle}`
    : `${notificationSubtitle}`;

  return (
    <div
      className="module-conversation-header__title"
      onClick={() => {
        if (isRightPanelOn) {
          dispatch(closeRightPanel());
        } else {
          dispatch(openRightPanel());
        }
      }}
      role="button"
    >
      <span className="module-contact-name__profile-name" data-testid="header-conversation-name">
        {convoName}
      </span>
      <StyledSubtitleContainer>
        <ConversationHeaderSubtitle text={fullTextSubtitle} />
      </StyledSubtitleContainer>
    </div>
  );
};

export const ConversationHeaderWithDetails = () => {
  const isSelectionMode = useSelector(isMessageSelectionMode);
  const isMessageDetailOpened = useSelector(isMessageDetailView);
  const selectedConvoKey = useSelectedConversationKey();
  const dispatch = useDispatch();
  const isKickedFromGroup = useIsKickedFromGroup(selectedConvoKey);
  const expireTimerSetting = useExpireTimer(selectedConvoKey);

  if (!selectedConvoKey) {
    return null;
  }

  const expirationSettingName = expireTimerSetting
    ? ExpirationTimerOptions.getName(expireTimerSetting || 0)
    : undefined;

  const triggerId = 'conversation-header';

  return (
    <div className="module-conversation-header">
      <div className="conversation-header--items-wrapper">
        <BackButton
          onGoBack={() => {
            dispatch(closeMessageDetailsView());
          }}
          showBackButton={isMessageDetailOpened}
        />
        <TripleDotsMenu triggerId={triggerId} showBackButton={isMessageDetailOpened} />

        <div className="module-conversation-header__title-container">
          <div className="module-conversation-header__title-flex">
            <ConversationHeaderTitle />
          </div>
        </div>

        {!isSelectionMode && (
          <Flex
            container={true}
            flexDirection="row"
            alignItems="center"
            flexGrow={0}
            flexShrink={0}
          >
            {!isKickedFromGroup && (
              <ExpirationLength expirationSettingName={expirationSettingName} />
            )}
            <CallButton />
            <AvatarHeader
              onAvatarClick={() => {
                dispatch(openRightPanel());
              }}
              pubkey={selectedConvoKey}
              showBackButton={isMessageDetailOpened}
            />
          </Flex>
        )}

        <ConversationHeaderMenu triggerId={triggerId} />
      </div>

      {isSelectionMode && <SelectionOverlay />}
    </div>
  );
};
