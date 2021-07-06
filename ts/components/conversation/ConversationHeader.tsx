import React from 'react';

import { Avatar, AvatarSize } from '../Avatar';

import { SessionIconButton, SessionIconSize, SessionIconType } from '../session/icon';

import { SessionButton, SessionButtonColor, SessionButtonType } from '../session/SessionButton';
import {
  ConversationAvatar,
  usingClosedConversationDetails,
} from '../session/usingClosedConversationDetails';
import { MemoConversationHeaderMenu } from '../session/menu/ConversationHeaderMenu';
import { contextMenu } from 'react-contexify';
import { useTheme } from 'styled-components';
import { ConversationNotificationSettingType } from '../../models/conversation';
import autoBind from 'auto-bind';

export interface TimerOption {
  name: string;
  value: number;
}

export interface NotificationForConvoOption {
  name: string;
  value: ConversationNotificationSettingType;
}

interface Props {
  id: string;
  name?: string;

  phoneNumber: string;
  profileName?: string;
  avatarPath?: string;

  isMe: boolean;
  isGroup: boolean;
  isPrivate: boolean;
  isPublic: boolean;
  isAdmin: boolean;

  // We might not always have the full list of members,
  // e.g. for open groups where we could have thousands
  // of members. We'll keep this for now (for closed chats)
  members: Array<any>;

  // not equal members.length (see above)
  subscriberCount?: number;

  expirationSettingName?: string;
  showBackButton: boolean;
  notificationForConvo: Array<NotificationForConvoOption>;
  currentNotificationSetting: ConversationNotificationSettingType;
  hasNickname: boolean;

  isBlocked: boolean;

  isKickedFromGroup: boolean;
  left: boolean;
  selectionMode: boolean; // is the UI on the message selection mode or not

  onCloseOverlay: () => void;
  onDeleteSelectedMessages: () => void;
  onAvatarClick?: (pubkey: string) => void;
  onGoBack: () => void;

  memberAvatars?: Array<ConversationAvatar>; // this is added by usingClosedConversationDetails
}

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

class ConversationHeaderInner extends React.Component<Props> {
  public constructor(props: Props) {
    super(props);

    autoBind(this);
  }

  public renderTitle() {
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
    } = this.props;
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
  }

  public render() {
    const { isKickedFromGroup, selectionMode, expirationSettingName, showBackButton } = this.props;
    const triggerId = 'conversation-header';
    console.warn('conversation header render', this.props);

    return (
      <div className="module-conversation-header">
        <div className="conversation-header--items-wrapper">
          <BackButton onGoBack={this.props.onGoBack} showBackButton={this.props.showBackButton} />

          <div className="module-conversation-header__title-container">
            <div className="module-conversation-header__title-flex">
              <TripleDotsMenu triggerId={triggerId} showBackButton={showBackButton} />
              {this.renderTitle()}
            </div>
          </div>
          {!isKickedFromGroup && <ExpirationLength expirationSettingName={expirationSettingName} />}

          {!selectionMode && (
            <AvatarHeader
              onAvatarClick={this.props.onAvatarClick}
              phoneNumber={this.props.phoneNumber}
              showBackButton={this.props.showBackButton}
              avatarPath={this.props.avatarPath}
              memberAvatars={this.props.memberAvatars}
              name={this.props.name}
              profileName={this.props.profileName}
            />
          )}

          <MemoConversationHeaderMenu
            conversationId={this.props.id}
            triggerId={triggerId}
            isMe={this.props.isMe}
            isPublic={this.props.isPublic}
            isGroup={this.props.isGroup}
            isKickedFromGroup={isKickedFromGroup}
            isAdmin={this.props.isAdmin}
            isBlocked={this.props.isBlocked}
            isPrivate={this.props.isPrivate}
            left={this.props.left}
            hasNickname={this.props.hasNickname}
            notificationForConvo={this.props.notificationForConvo}
            currentNotificationSetting={this.props.currentNotificationSetting}
          />
        </div>

        {selectionMode && (
          <SelectionOverlay
            isPublic={this.props.isPublic}
            onCloseOverlay={this.props.onCloseOverlay}
            onDeleteSelectedMessages={this.props.onDeleteSelectedMessages}
          />
        )}
      </div>
    );
  }
}

export const ConversationHeaderWithDetails = usingClosedConversationDetails(
  ConversationHeaderInner
);
