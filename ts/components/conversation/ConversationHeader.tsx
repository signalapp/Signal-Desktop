import React from 'react';

import { Avatar } from '../Avatar';
import { LocalizerType } from '../../types/Util';

import {
  SessionIconButton,
  SessionIconSize,
  SessionIconType,
} from '../session/icon';

import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from '../session/SessionButton';
import {
  ConversationAvatar,
  usingClosedConversationDetails,
} from '../session/usingClosedConversationDetails';
import { MenuProvider } from 'react-contexify';
import {
  ConversationHeaderMenu,
  PropsConversationHeaderMenu,
} from '../session/menu/ConversationHeaderMenu';

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

  isVerified: boolean;
  isMe: boolean;
  isClosable?: boolean;
  isGroup: boolean;
  isPrivate: boolean;
  isPublic: boolean;
  isRss: boolean;
  amMod: boolean;

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
  isOnline?: boolean;

  isKickedFromGroup: boolean;
  selectionMode: boolean; // is the UI on the message selection mode or not

  onInviteContacts: () => void;
  onSetDisappearingMessages: (seconds: number) => void;
  onDeleteMessages: () => void;
  onDeleteContact: () => void;
  onResetSession: () => void;

  onCloseOverlay: () => void;
  onDeleteSelectedMessages: () => void;

  onShowSafetyNumber: () => void;
  onGoBack: () => void;

  onBlockUser: () => void;
  onUnblockUser: () => void;

  onCopyPublicKey: () => void;

  onLeaveGroup: () => void;
  onAddModerators: () => void;
  onRemoveModerators: () => void;
  onAvatarClick?: (userPubKey: string) => void;
  onUpdateGroupName: () => void;

  memberAvatars?: Array<ConversationAvatar>; // this is added by usingClosedConversationDetails
}

class ConversationHeader extends React.Component<Props> {
  public onAvatarClickBound: (userPubKey: string) => void;

  public constructor(props: Props) {
    super(props);

    this.onAvatarClickBound = this.onAvatarClick.bind(this);
  }

  public renderBackButton() {
    const { onGoBack, showBackButton } = this.props;

    if (!showBackButton) {
      return null;
    }

    return (
      <div
        onClick={onGoBack}
        role="button"
        className="module-conversation-header__back-icon"
      />
    );
  }

  public renderTitle() {
    const {
      phoneNumber,
      profileName,
      isGroup,
      isPublic,
      isRss,
      members,
      subscriberCount,
      isMe,
      isKickedFromGroup,
      name,
    } = this.props;
    const { i18n } = window;

    if (isMe) {
      return (
        <div className="module-conversation-header__title">
          {i18n('noteToSelf')}
        </div>
      );
    }

    const memberCount: number = (() => {
      if (!isGroup || isRss) {
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
    const {
      avatarPath,
      memberAvatars,
      name,
      phoneNumber,
      profileName,
    } = this.props;

    const userName = name || profileName || phoneNumber;

    return (
      <span className="module-conversation-header__avatar">
        <Avatar
          avatarPath={avatarPath}
          name={userName}
          size={36}
          onAvatarClick={() => {
            this.onAvatarClickBound(phoneNumber);
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

  public renderSearch() {
    return (
      <div className="search-icon">
        <SessionIconButton
          iconType={SessionIconType.Search}
          iconSize={SessionIconSize.Large}
          iconPadded={true}
          onClick={this.highlightMessageSearch}
        />
      </div>
    );
  }

  public renderSelectionOverlay() {
    const { onDeleteSelectedMessages, onCloseOverlay, isPublic } = this.props;
    const { i18n } = window;

    const isServerDeletable = isPublic;
    const deleteMessageButtonText = i18n(
      isServerDeletable ? 'deleteForEveryone' : 'delete'
    );

    return (
      <div className="message-selection-overlay">
        <div className="close-button">
          <SessionIconButton
            iconType={SessionIconType.Exit}
            iconSize={SessionIconSize.Medium}
            onClick={onCloseOverlay}
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
              <MenuProvider id={triggerId} event="onClick">
                <SessionIconButton
                  iconType={SessionIconType.Ellipses}
                  iconSize={SessionIconSize.Medium}
                />
              </MenuProvider>
              {this.renderTitle()}
            </div>
          </div>
          {!isKickedFromGroup && this.renderExpirationLength()}

          {!this.props.isRss && !selectionMode && this.renderAvatar()}

          <ConversationHeaderMenu {...this.getHeaderMenuProps(triggerId)} />
        </div>

        {selectionMode && this.renderSelectionOverlay()}
      </div>
    );
  }

  public onAvatarClick(userPubKey: string) {
    if (this.props.onAvatarClick) {
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
}

export const ConversationHeaderWithDetails = usingClosedConversationDetails(
  ConversationHeader
);
