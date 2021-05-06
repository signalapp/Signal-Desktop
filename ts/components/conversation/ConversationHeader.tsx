import React from 'react';

import { Avatar, AvatarSize } from '../Avatar';

import { SessionIconButton, SessionIconSize, SessionIconType } from '../session/icon';

import { SessionButton, SessionButtonColor, SessionButtonType } from '../session/SessionButton';
import {
  ConversationAvatar,
  usingClosedConversationDetails,
} from '../session/usingClosedConversationDetails';
import {
  ConversationHeaderMenu,
  PropsConversationHeaderMenu,
} from '../session/menu/ConversationHeaderMenu';
import { contextMenu } from 'react-contexify';
import { DefaultTheme, withTheme } from 'styled-components';

export interface TimerOption {
  name: string;
  value: number;
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
  timerOptions: Array<TimerOption>;
  hasNickname?: boolean;

  isBlocked: boolean;

  isKickedFromGroup: boolean;
  left: boolean;
  selectionMode: boolean; // is the UI on the message selection mode or not

  onInviteContacts: () => void;
  onSetDisappearingMessages: (seconds: number) => void;
  onDeleteMessages: () => void;
  onDeleteContact: () => void;

  onCloseOverlay: () => void;
  onDeleteSelectedMessages: () => void;

  onGoBack: () => void;

  onBlockUser: () => void;
  onUnblockUser: () => void;

  onCopyPublicKey: () => void;

  onLeaveGroup: () => void;
  onAddModerators: () => void;
  onRemoveModerators: () => void;
  onAvatarClick?: (userPubKey: string) => void;
  onUpdateGroupName: () => void;

  onMarkAllRead: () => void;

  memberAvatars?: Array<ConversationAvatar>; // this is added by usingClosedConversationDetails
  theme: DefaultTheme;
}

class ConversationHeaderInner extends React.Component<Props> {
  public constructor(props: Props) {
    super(props);

    this.onAvatarClick = this.onAvatarClick.bind(this);
  }

  public renderBackButton() {
    const { onGoBack, showBackButton } = this.props;

    if (!showBackButton) {
      return null;
    }

    return (
      <SessionIconButton
        iconType={SessionIconType.Chevron}
        iconSize={SessionIconSize.Large}
        iconRotation={90}
        onClick={onGoBack}
        theme={this.props.theme}
      />
    );
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

  public renderAvatar() {
    const { avatarPath, memberAvatars, name, phoneNumber, profileName } = this.props;

    const userName = name || profileName || phoneNumber;

    return (
      <span className="module-conversation-header__avatar">
        <Avatar
          avatarPath={avatarPath}
          name={userName}
          size={AvatarSize.S}
          onAvatarClick={() => {
            this.onAvatarClick(phoneNumber);
          }}
          memberAvatars={memberAvatars}
          pubkey={phoneNumber}
        />
      </span>
    );
  }

  public renderExpirationLength() {
    const { expirationSettingName } = this.props;

    if (!expirationSettingName) {
      return null;
    }

    return (
      <div className="module-conversation-header__expiration">
        <div className="module-conversation-header__expiration__clock-icon" />
        <div className="module-conversation-header__expiration__setting">
          {expirationSettingName}
        </div>
      </div>
    );
  }

  public renderSelectionOverlay() {
    const { onDeleteSelectedMessages, onCloseOverlay, isPublic } = this.props;
    const { i18n } = window;

    const isServerDeletable = isPublic;
    const deleteMessageButtonText = i18n(isServerDeletable ? 'deleteForEveryone' : 'delete');

    return (
      <div className="message-selection-overlay">
        <div className="close-button">
          <SessionIconButton
            iconType={SessionIconType.Exit}
            iconSize={SessionIconSize.Medium}
            onClick={onCloseOverlay}
            theme={this.props.theme}
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
  }

  public render() {
    const { isKickedFromGroup, selectionMode } = this.props;
    const triggerId = 'conversation-header';

    return (
      <div className="module-conversation-header">
        <div className="conversation-header--items-wrapper">
          {this.renderBackButton()}
          <div className="module-conversation-header__title-container">
            <div className="module-conversation-header__title-flex">
              {this.renderTripleDotsMenu(triggerId)}
              {this.renderTitle()}
            </div>
          </div>
          {!isKickedFromGroup && this.renderExpirationLength()}

          {!selectionMode && this.renderAvatar()}

          <ConversationHeaderMenu {...this.getHeaderMenuProps(triggerId)} />
        </div>

        {selectionMode && this.renderSelectionOverlay()}
      </div>
    );
  }

  public onAvatarClick(userPubKey: string) {
    // do not allow right panel to appear if another button is shown on the SessionConversation
    if (this.props.onAvatarClick && !this.props.showBackButton) {
      this.props.onAvatarClick(userPubKey);
    }
  }

  public highlightMessageSearch() {
    // This is a temporary fix. In future we want to search
    // messages in the current conversation
    ($('.session-search-input input') as any).focus();
  }

  private getHeaderMenuProps(triggerId: string): PropsConversationHeaderMenu {
    return {
      triggerId,
      ...this.props,
    };
  }

  private renderTripleDotsMenu(triggerId: string) {
    const { showBackButton } = this.props;
    if (showBackButton) {
      return <></>;
    }
    return (
      <div
        role="button"
        onClick={(e: any) => {
          contextMenu.show({
            id: triggerId,
            event: e,
          });
        }}
      >
        <SessionIconButton
          iconType={SessionIconType.Ellipses}
          iconSize={SessionIconSize.Medium}
          theme={this.props.theme}
        />
      </div>
    );
  }
}

export const ConversationHeaderWithDetails = usingClosedConversationDetails(
  withTheme(ConversationHeaderInner)
);
