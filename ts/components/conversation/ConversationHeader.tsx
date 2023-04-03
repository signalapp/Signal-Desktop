import React, { useState } from 'react';

import { Avatar, AvatarSize } from '../avatar/Avatar';

import { contextMenu } from 'react-contexify';
import styled, { CSSProperties } from 'styled-components';
import { ConversationNotificationSettingType } from '../../models/conversationAttributes';
import {
  getConversationHeaderTitleProps,
  getCurrentNotificationSettingText,
  getIsSelectedActive,
  getIsSelectedBlocked,
  getIsSelectedNoteToSelf,
  getIsSelectedPrivate,
  getSelectedConversationIsPublic,
  getSelectedConversationKey,
  getSelectedMessageIds,
  isMessageDetailView,
  isMessageSelectionMode,
  isRightPanelShowing,
} from '../../state/selectors/conversations';
import { useDispatch, useSelector } from 'react-redux';

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
import { callRecipient } from '../../interactions/conversationInteractions';
import { getHasIncomingCall, getHasOngoingCall } from '../../state/selectors/call';
import {
  useConversationUsername,
  useExpireTimer,
  useIsKickedFromGroup,
  useIsRequest,
} from '../../hooks/useParamSelector';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonShape,
  SessionButtonType,
} from '../basic/SessionButton';
import { SessionIconButton } from '../icon';
import { ConversationHeaderMenu } from '../menu/ConversationHeaderMenu';
import { Flex } from '../basic/Flex';
import {
  DisappearingMessageConversationType,
  ExpirationTimerOptions,
} from '../../util/expiringMessages';

export interface TimerOption {
  name: string;
  value: number;
}

export type ConversationHeaderProps = {
  conversationKey: string;
  name?: string;

  profileName?: string;
  avatarPath: string | null;

  isMe: boolean;
  isGroup: boolean;
  isPrivate: boolean;
  isPublic: boolean;
  weAreAdmin: boolean;

  // We might not always have the full list of members,
  // e.g. for open groups where we could have thousands
  // of members. We'll keep this for now (for closed chats)
  members: Array<any>;

  // not equal members.length (see above)
  subscriberCount?: number;

  expirationSettingName?: string;
  currentNotificationSetting: ConversationNotificationSettingType;
  hasNickname: boolean;

  isBlocked: boolean;

  isKickedFromGroup: boolean;
  left: boolean;
};

const SelectionOverlay = () => {
  const selectedMessageIds = useSelector(getSelectedMessageIds);
  const selectedConversationKey = useSelector(getSelectedConversationKey);
  const isPublic = useSelector(getSelectedConversationIsPublic);
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
  if (showBackButton) {
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
      margin="0 10px 0 0"
      onClick={() => {
        void callRecipient(selectedConvoKey, canCall);
      }}
    />
  );
};

export const StyledSubtitleContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 230px;

  div:first-child {
    span:last-child {
      margin-bottom: 0;
    }
  }
`;

const StyledSubtitleDot = styled.span<{ active: boolean }>`
  border-radius: 50%;
  background-color: ${props =>
    props.active ? 'var(--text-primary-color)' : 'var(--text-secondary-color)'};

  height: 6px;
  width: 6px;
  margin: 0 3px;
`;

const SubtitleDotMenu = ({
  options,
  selectedOptionIndex,
  style,
}: {
  options: Array<string | null>;
  selectedOptionIndex: number;
  style: CSSProperties;
}) => (
  <Flex container={true} alignItems={'center'} style={style}>
    {options.map((option, index) => {
      if (!option) {
        return null;
      }

      return (
        <StyledSubtitleDot
          key={`subtitleDotMenu-${index}`}
          active={selectedOptionIndex === index}
        />
      );
    })}
  </Flex>
);

export type ConversationHeaderTitleProps = {
  conversationKey: string;
  isMe: boolean;
  isGroup: boolean;
  isPublic: boolean;
  members: Array<any>;
  subscriberCount?: number;
  isKickedFromGroup: boolean;
  currentNotificationSetting?: ConversationNotificationSettingType;
  expirationType?: DisappearingMessageConversationType;
  expireTimer?: number;
};

const ConversationHeaderTitle = () => {
  const headerTitleProps = useSelector(getConversationHeaderTitleProps);
  const notificationSetting = useSelector(getCurrentNotificationSettingText);
  const isRightPanelOn = useSelector(isRightPanelShowing);

  const convoName = useConversationUsername(headerTitleProps?.conversationKey);
  const dispatch = useDispatch();

  const [visibleTitleIndex, setVisibleTitleIndex] = useState(0);

  if (!headerTitleProps) {
    return null;
  }

  const {
    isGroup,
    isPublic,
    members,
    subscriberCount,
    isMe,
    isKickedFromGroup,
    expirationType,
    expireTimer,
  } = headerTitleProps;

  const { i18n } = window;

  const notificationSubtitle = notificationSetting
    ? i18n('notificationSubtitle', [notificationSetting])
    : null;

  let memberCount = 0;
  if (isGroup) {
    if (isPublic) {
      memberCount = subscriberCount || 0;
    } else {
      memberCount = members.length;
    }
  }

  let memberCountSubtitle = null;
  if (isGroup && memberCount > 0 && !isKickedFromGroup) {
    const count = String(memberCount);
    memberCountSubtitle = isPublic ? i18n('activeMembers', [count]) : i18n('members', [count]);
  }

  const disappearingMessageSettingText =
    expirationType === 'off'
      ? window.i18n('disappearingMessagesModeOff')
      : expirationType === 'deleteAfterRead'
      ? window.i18n('disappearingMessagesModeAfterRead')
      : window.i18n('disappearingMessagesModeAfterSend');
  const abbreviatedExpireTime = Boolean(expireTimer)
    ? ExpirationTimerOptions.getAbbreviated(expireTimer)
    : null;
  const disappearingMessageSubtitle = `${disappearingMessageSettingText}${
    abbreviatedExpireTime ? ` - ${abbreviatedExpireTime}` : ''
  }`;

  const subtitles = [
    notificationSubtitle && notificationSubtitle,
    memberCountSubtitle && memberCountSubtitle,
    disappearingMessageSubtitle && disappearingMessageSubtitle,
  ];
  window.log.info(`WIP: subtitles`, subtitles);

  // const fullTextSubtitle = memberCountText
  //   ? `${memberCountText} ● ${notificationSubtitle}`
  //   : `${notificationSubtitle}`;

  const handleTitleCycle = (direction: 1 | -1) => {
    let newIndex = visibleTitleIndex + direction;
    if (newIndex > subtitles.length - 1) {
      newIndex = 0;
    }

    if (newIndex < 0) {
      newIndex = subtitles.length - 1;
    }

    if (subtitles[newIndex]) {
      setVisibleTitleIndex(newIndex);
    }
  };

  if (isMe) {
    // TODO customise for new disappearing message system
    return <div className="module-conversation-header__title">{i18n('noteToSelf')}</div>;
  }

  return (
    <div
      className="module-conversation-header__title"
      // onClick={() => {
      //   if (isRightPanelOn) {
      //     dispatch(closeRightPanel());
      //   } else {
      //     dispatch(openRightPanel());
      //   }
      // }}
      role="button"
    >
      <span className="module-contact-name__profile-name" data-testid="header-conversation-name">
        {convoName}
      </span>
      {subtitles && (
        <StyledSubtitleContainer>
          <Flex
            container={true}
            flexDirection={'row'}
            justifyContent={'space-between'}
            alignItems={'center'}
            width={'100%'}
          >
            <SessionIconButton
              iconColor={'var(--button-icon-stroke-selected-color)'}
              iconSize={'medium'}
              iconType="chevron"
              iconRotation={90}
              margin={'0 var(--margins-xs) 0 0'}
              onClick={() => {
                handleTitleCycle(-1);
              }}
            />
            {visibleTitleIndex === 2 && (
              <SessionIconButton
                iconColor={'var(--button-icon-stroke-selected-color)'}
                iconSize={'tiny'}
                iconType="timer50"
                margin={'0 var(--margins-xs) 0 0'}
              />
            )}
            <span className="module-conversation-header__title-text">
              {subtitles[visibleTitleIndex]}
            </span>
            <SessionIconButton
              iconColor={'var(--button-icon-stroke-selected-color)'}
              iconSize={'medium'}
              iconType="chevron"
              iconRotation={270}
              margin={'0 0 0 var(--margins-xs)'}
              onClick={() => {
                handleTitleCycle(1);
              }}
            />
          </Flex>
          <SubtitleDotMenu
            options={subtitles}
            selectedOptionIndex={visibleTitleIndex}
            style={{ margin: 'var(--margins-xs) 0' }}
          />
        </StyledSubtitleContainer>
      )}
    </div>
  );
};

export const ConversationHeaderWithDetails = () => {
  const isSelectionMode = useSelector(isMessageSelectionMode);
  const isMessageDetailOpened = useSelector(isMessageDetailView);
  const selectedConvoKey = useSelector(getSelectedConversationKey);
  const dispatch = useDispatch();

  if (!selectedConvoKey) {
    return null;
  }

  const isKickedFromGroup = useIsKickedFromGroup(selectedConvoKey);
  const expireTimerSetting = useExpireTimer(selectedConvoKey);
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
