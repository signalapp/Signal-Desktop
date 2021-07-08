import React from 'react';

import { Avatar, AvatarSize } from '../Avatar';

import { SessionIconButton, SessionIconSize, SessionIconType } from '../session/icon';

import { SessionButton, SessionButtonColor, SessionButtonType } from '../session/SessionButton';
import { ConversationAvatar } from '../session/usingClosedConversationDetails';
import { MemoConversationHeaderMenu } from '../session/menu/ConversationHeaderMenu';
import { contextMenu } from 'react-contexify';
import { useTheme } from 'styled-components';
import { ConversationNotificationSettingType } from '../../models/conversation';
import {
  getConversationHeaderProps,
  getConversationHeaderTitleProps,
  getSelectedConversation,
} from '../../state/selectors/conversations';
import { useSelector } from 'react-redux';
import { useMembersAvatars } from '../../hooks/useMembersAvatar';

export interface TimerOption {
  name: string;
  value: number;
}

export interface NotificationForConvoOption {
  name: string;
  value: ConversationNotificationSettingType;
}

export type ConversationHeaderProps = {
  id: string;
  name?: string;

  phoneNumber: string;
  profileName?: string;
  avatarPath?: string;

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
  // showBackButton: boolean;
  notificationForConvo: Array<NotificationForConvoOption>;
  currentNotificationSetting: ConversationNotificationSettingType;
  hasNickname: boolean;

  isBlocked: boolean;

  isKickedFromGroup: boolean;
  left: boolean;
  // selectionMode: boolean; // is the UI on the message selection mode or not

  // onCloseOverlay: () => void;
  // onDeleteSelectedMessages: () => void;
  // onAvatarClick?: (pubkey: string) => void;
  // onGoBack: () => void;

  // memberAvatars?: Array<ConversationAvatar>; // this is added by usingClosedConversationDetails
};

const SelectionOverlay = (props: {
  onDeleteSelectedMessages: () => void;
  onCloseOverlay: () => void;
  isPublic: boolean;
}) => {
  const { onDeleteSelectedMessages, onCloseOverlay, isPublic } = props;
  const { i18n } = window;
  const theme = useTheme();

  const isServerDeletable = isPublic;
  const deleteMessageButtonText = i18n(isServerDeletable ? 'deleteForEveryone' : 'delete');

  return (
    <div className="message-selection-overlay">
      <div className="close-button">
        <SessionIconButton
          iconType={SessionIconType.Exit}
          iconSize={SessionIconSize.Medium}
          onClick={onCloseOverlay}
          theme={theme}
        />
      </div>

      <div className="button-group">
        <SessionButton
          buttonType={SessionButtonType.Default}
          buttonColor={SessionButtonColor.Danger}
          text={deleteMessageButtonText}
          onClick={onDeleteSelectedMessages}
        />
      </div>
    </div>
  );
};

const TripleDotsMenu = (props: { triggerId: string; showBackButton: boolean }) => {
  const { showBackButton } = props;
  const theme = useTheme();
  if (showBackButton) {
    return <></>;
  }
  return (
    <div
      role="button"
      onClick={(e: any) => {
        contextMenu.show({
          id: props.triggerId,
          event: e,
        });
      }}
    >
      <SessionIconButton
        iconType={SessionIconType.Ellipses}
        iconSize={SessionIconSize.Medium}
        theme={theme}
      />
    </div>
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
      <div className="module-conversation-header__expiration__setting">{expirationSettingName}</div>
    </div>
  );
};

const AvatarHeader = (props: {
  avatarPath?: string;
  memberAvatars?: Array<ConversationAvatar>;
  name?: string;
  phoneNumber: string;
  profileName?: string;
  showBackButton: boolean;
  onAvatarClick?: (pubkey: string) => void;
}) => {
  const { avatarPath, memberAvatars, name, phoneNumber, profileName } = props;
  const userName = name || profileName || phoneNumber;

  return (
    <span className="module-conversation-header__avatar">
      <Avatar
        avatarPath={avatarPath}
        name={userName}
        size={AvatarSize.S}
        onAvatarClick={() => {
          // do not allow right panel to appear if another button is shown on the SessionConversation
          if (props.onAvatarClick && !props.showBackButton) {
            props.onAvatarClick(phoneNumber);
          }
        }}
        memberAvatars={memberAvatars}
        pubkey={phoneNumber}
      />
    </span>
  );
};

const BackButton = (props: { onGoBack: () => void; showBackButton: boolean }) => {
  const { onGoBack, showBackButton } = props;
  const theme = useTheme();
  if (!showBackButton) {
    return null;
  }

  return (
    <SessionIconButton
      iconType={SessionIconType.Chevron}
      iconSize={SessionIconSize.Large}
      iconRotation={90}
      onClick={onGoBack}
      theme={theme}
    />
  );
};

export type ConversationHeaderTitleProps = {
  phoneNumber: string;
  profileName?: string;
  isMe: boolean;
  isGroup: boolean;
  isPublic: boolean;
  members: Array<any>;
  subscriberCount?: number;
  isKickedFromGroup: boolean;
  name?: string;
};

const ConversationHeaderTitle = () => {
  const headerTitleProps = useSelector(getConversationHeaderTitleProps);
  if (!headerTitleProps) {
    return null;
  }

  const {
    phoneNumber,
    profileName,
    isGroup,
    isPublic,
    members,
    subscriberCount,
    isMe,
    isKickedFromGroup,
    name,
  } = headerTitleProps;

  const { i18n } = window;

  if (isMe) {
    return <div className="module-conversation-header__title">{i18n('noteToSelf')}</div>;
  }

  const memberCount: number = (() => {
    if (!isGroup) {
      return 0;
    }

    if (isPublic) {
      return subscriberCount || 0;
    } else {
      return members.length;
    }
  })();

  let text = '';
  if (isGroup && memberCount > 0) {
    const count = String(memberCount);
    text = i18n('members', [count]);
  }

  const textEl =
    text === '' || isKickedFromGroup ? null : (
      <span className="module-conversation-header__title-text">{text}</span>
    );

  const title = profileName || name || phoneNumber;

  return (
    <div className="module-conversation-header__title">
      <span className="module-contact-name__profile-name">{title}</span>
      {textEl}
    </div>
  );
};

export type ConversationHeaderNonReduxProps = {
  showBackButton: boolean;
  selectionMode: boolean;
  onDeleteSelectedMessages: () => void;
  onCloseOverlay: () => void;
  onAvatarClick: () => void;
  onGoBack: () => void;
};

export const ConversationHeaderWithDetails = (
  headerPropsNonRedux: ConversationHeaderNonReduxProps
) => {
  const headerProps = useSelector(getConversationHeaderProps);
  const selectedConversation = useSelector(getSelectedConversation);
  const memberDetails = useMembersAvatars(selectedConversation);

  if (!headerProps) {
    return null;
  }
  const {
    isKickedFromGroup,
    expirationSettingName,
    phoneNumber,
    avatarPath,
    name,
    profileName,
    id,
    isMe,
    isPublic,
    notificationForConvo,
    currentNotificationSetting,
    hasNickname,
    weAreAdmin,
    isBlocked,
    left,
    isPrivate,
    isGroup,
  } = headerProps;

  const {
    onGoBack,
    onAvatarClick,
    onCloseOverlay,
    onDeleteSelectedMessages,
    showBackButton,
    selectionMode,
  } = headerPropsNonRedux;
  const triggerId = 'conversation-header';

  return (
    <div className="module-conversation-header">
      <div className="conversation-header--items-wrapper">
        <BackButton onGoBack={onGoBack} showBackButton={showBackButton} />

        <div className="module-conversation-header__title-container">
          <div className="module-conversation-header__title-flex">
            <TripleDotsMenu triggerId={triggerId} showBackButton={showBackButton} />
            <ConversationHeaderTitle />
          </div>
        </div>
        {!isKickedFromGroup && <ExpirationLength expirationSettingName={expirationSettingName} />}

        {!selectionMode && (
          <AvatarHeader
            onAvatarClick={onAvatarClick}
            phoneNumber={phoneNumber}
            showBackButton={showBackButton}
            avatarPath={avatarPath}
            memberAvatars={memberDetails}
            name={name}
            profileName={profileName}
          />
        )}

        <MemoConversationHeaderMenu
          conversationId={id}
          triggerId={triggerId}
          isMe={isMe}
          isPublic={isPublic}
          isGroup={isGroup}
          isKickedFromGroup={isKickedFromGroup}
          weAreAdmin={weAreAdmin}
          isBlocked={isBlocked}
          isPrivate={isPrivate}
          left={left}
          hasNickname={hasNickname}
          notificationForConvo={notificationForConvo}
          currentNotificationSetting={currentNotificationSetting}
        />
      </div>

      {selectionMode && (
        <SelectionOverlay
          isPublic={isPublic}
          onCloseOverlay={onCloseOverlay}
          onDeleteSelectedMessages={onDeleteSelectedMessages}
        />
      )}
    </div>
  );
};
