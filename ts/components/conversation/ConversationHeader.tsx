import React from 'react';

import { Avatar } from '../Avatar';
import { Colors, LocalizerType } from '../../types/Util';
import { ContextMenu, ContextMenuTrigger, MenuItem } from 'react-contextmenu';

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
import * as Menu from '../../session/utils/Menu';
import {
  ConversationAvatar,
  usingClosedConversationDetails,
} from '../session/usingClosedConversationDetails';

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

  // We don't pass this as a bool, because in future we
  // want to forward messages from Header and will need
  // the message ID.
  selectedMessages: Array<string>;
  isKickedFromGroup: boolean;

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

  i18n: LocalizerType;
  memberAvatars?: Array<ConversationAvatar>; // this is added by usingClosedConversationDetails
}

class ConversationHeader extends React.Component<Props> {
  public showMenuBound: (event: React.MouseEvent<HTMLDivElement>) => void;
  public onAvatarClickBound: (userPubKey: string) => void;
  public menuTriggerRef: React.RefObject<any>;

  public constructor(props: Props) {
    super(props);

    this.menuTriggerRef = React.createRef();
    this.showMenuBound = this.showMenu.bind(this);
    this.onAvatarClickBound = this.onAvatarClick.bind(this);
  }

  public showMenu(event: React.MouseEvent<HTMLDivElement>) {
    if (this.menuTriggerRef.current) {
      this.menuTriggerRef.current.handleContextClick(event);
    }
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
      i18n,
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

  public renderOptions(triggerId: string) {
    const { showBackButton } = this.props;

    if (showBackButton) {
      return null;
    }

    return (
      <ContextMenuTrigger
        id={triggerId}
        ref={this.menuTriggerRef}
        holdToDisplay={1}
      >
        <SessionIconButton
          iconType={SessionIconType.Ellipses}
          iconSize={SessionIconSize.Medium}
          onClick={this.showMenuBound}
        />
      </ContextMenuTrigger>
    );
  }

  public renderMenu(triggerId: string) {
    const {
      i18n,
      isMe,
      isClosable,
      isPublic,
      isRss,
      isGroup,
      isKickedFromGroup,
      amMod,
      onDeleteMessages,
      onDeleteContact,
      onCopyPublicKey,
      onLeaveGroup,
      onAddModerators,
      onRemoveModerators,
      onInviteContacts,
      onUpdateGroupName,
    } = this.props;

    return (
      <ContextMenu id={triggerId}>
        {this.renderPublicMenuItems()}
        {Menu.getCopyMenuItem(isPublic, isRss, isGroup, onCopyPublicKey, i18n)}
        {Menu.getDeleteMessagesMenuItem(isPublic, onDeleteMessages, i18n)}
        {Menu.getAddModeratorsMenuItem(
          amMod,
          isKickedFromGroup,
          onAddModerators,
          i18n
        )}
        {Menu.getRemoveModeratorsMenuItem(
          amMod,
          isKickedFromGroup,
          onRemoveModerators,
          i18n
        )}
        {Menu.getUpdateGroupNameMenuItem(
          amMod,
          isKickedFromGroup,
          onUpdateGroupName,
          i18n
        )}
        {Menu.getLeaveGroupMenuItem(
          isKickedFromGroup,
          isGroup,
          isPublic,
          isRss,
          onLeaveGroup,
          i18n
        )}
        {/* TODO: add delete group */}
        {Menu.getInviteContactMenuItem(
          isGroup,
          isPublic,
          onInviteContacts,
          i18n
        )}
        {Menu.getDeleteContactMenuItem(
          isMe,
          isClosable,
          isGroup,
          isPublic,
          isRss,
          onDeleteContact,
          i18n
        )}
      </ContextMenu>
    );
  }

  public renderSelectionOverlay() {
    const {
      onDeleteSelectedMessages,
      onCloseOverlay,
      isPublic,
      i18n,
    } = this.props;
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
    const { id, isKickedFromGroup } = this.props;
    const triggerId = `conversation-header-${id}-${Date.now()}`;
    const selectionMode = !!this.props.selectedMessages.length;

    return (
      <div className="module-conversation-header">
        <div className="conversation-header--items-wrapper">
          {this.renderBackButton()}
          <div className="module-conversation-header__title-container">
            <div className="module-conversation-header__title-flex">
              {!selectionMode && this.renderOptions(triggerId)}
              {this.renderTitle()}
            </div>
          </div>
          {!isKickedFromGroup && this.renderExpirationLength()}

          {!this.props.isRss && !selectionMode && this.renderAvatar()}

          {!selectionMode && this.renderMenu(triggerId)}
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

  // tslint:disable-next-line: cyclomatic-complexity
  private renderPublicMenuItems() {
    const {
      i18n,
      isBlocked,
      isMe,
      isGroup,
      isPrivate,
      isKickedFromGroup,
      isPublic,
      isRss,
      onResetSession,
      onSetDisappearingMessages,
      onShowSafetyNumber,
      timerOptions,
      onBlockUser,
      onUnblockUser,
    } = this.props;

    const disappearingMessagesMenuItem = Menu.getDisappearingMenuItem(
      isPublic,
      isRss,
      isKickedFromGroup,
      isBlocked,
      timerOptions,
      onSetDisappearingMessages,
      i18n
    );

    const showSafetyNumberMenuItem = Menu.getShowSafetyNumberMenuItem(
      isPublic,
      isRss,
      isGroup,
      isMe,
      onShowSafetyNumber,
      i18n
    );
    const resetSessionMenuItem = Menu.getResetSessionMenuItem(
      isPublic,
      isRss,
      isGroup,
      isBlocked,
      onResetSession,
      i18n
    );
    const blockHandlerMenuItem = Menu.getBlockMenuItem(
      isMe,
      isPrivate,
      isBlocked,
      onBlockUser,
      onUnblockUser,
      i18n
    );

    return (
      <React.Fragment>
        {disappearingMessagesMenuItem}
        {showSafetyNumberMenuItem}
        {resetSessionMenuItem}
        {blockHandlerMenuItem}
      </React.Fragment>
    );
  }
}

export const ConversationHeaderWithDetails = usingClosedConversationDetails(
  ConversationHeader
);
