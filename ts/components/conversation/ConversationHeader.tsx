import React from 'react';

import { Avatar } from '../Avatar';
import { Colors, LocalizerType } from '../../types/Util';
import {
  ContextMenu,
  ContextMenuTrigger,
  MenuItem,
  SubMenu,
} from 'react-contextmenu';

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
  onShowAllMedia: () => void;
  onShowGroupMembers: () => void;
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
}

export class ConversationHeader extends React.Component<Props> {
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

    let title;
    if (profileName) {
      title = `${profileName} ${window.shortenPubkey(phoneNumber)}`;
    } else {
      if (name) {
        title = `${name}`;
      } else {
        title = `User ${window.shortenPubkey(phoneNumber)}`;
      }
    }

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
      i18n,
      isGroup,
      isMe,
      name,
      phoneNumber,
      profileName,
      isOnline,
    } = this.props;

    const borderColor = isOnline ? Colors.ONLINE : Colors.OFFLINE_LIGHT;
    const conversationType = isGroup ? 'group' : 'direct';

    return (
      <span className="module-conversation-header__avatar">
        <Avatar
          avatarPath={avatarPath}
          conversationType={conversationType}
          i18n={i18n}
          noteToSelf={isMe}
          name={name}
          phoneNumber={phoneNumber}
          profileName={profileName}
          size={28}
          borderColor={borderColor}
          borderWidth={0}
          onAvatarClick={() => {
            this.onAvatarClickBound(phoneNumber);
          }}
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

    const isPrivateGroup = isGroup && !isPublic && !isRss;

    const copyIdLabel = isGroup ? i18n('copyChatId') : i18n('copyPublicKey');

    return (
      <ContextMenu id={triggerId}>
        {this.renderPublicMenuItems()}
        {!isRss ? (
          <MenuItem onClick={onCopyPublicKey}>{copyIdLabel}</MenuItem>
        ) : null}
        <MenuItem onClick={onDeleteMessages}>{i18n('deleteMessages')}</MenuItem>
        {amMod && !isKickedFromGroup ? (
          <MenuItem onClick={onAddModerators}>{i18n('addModerators')}</MenuItem>
        ) : null}
        {amMod && !isKickedFromGroup ? (
          <MenuItem onClick={onRemoveModerators}>
            {i18n('removeModerators')}
          </MenuItem>
        ) : null}
        {amMod && !isKickedFromGroup ? (
          <MenuItem onClick={onUpdateGroupName}>
            {i18n('editGroupNameOrPicture')}
          </MenuItem>
        ) : null}
        {isPrivateGroup && !isKickedFromGroup ? (
          <MenuItem onClick={onLeaveGroup}>{i18n('leaveGroup')}</MenuItem>
        ) : null}
        {/* TODO: add delete group */}
        {isGroup && isPublic ? (
          <MenuItem onClick={onInviteContacts}>
            {i18n('inviteContacts')}
          </MenuItem>
        ) : null}
        {!isMe && isClosable && !isPrivateGroup ? (
          !isPublic ? (
            <MenuItem onClick={onDeleteContact}>
              {i18n('deleteContact')}
            </MenuItem>
          ) : (
            <MenuItem onClick={onDeleteContact}>
              {i18n('deletePublicChannel')}
            </MenuItem>
          )
        ) : null}
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
      isServerDeletable ? 'unsend' : 'delete'
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
    const triggerId = `conversation-${id}-${Date.now()}`;
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
    $('.session-search-input input').focus();
  }

  // tslint:disable-next-line: cyclomatic-complexity
  private renderPublicMenuItems() {
    const {
      i18n,
      isBlocked,
      isMe,
      isGroup,
      isKickedFromGroup,
      isPublic,
      isRss,
      onResetSession,
      onSetDisappearingMessages,
      onShowGroupMembers,
      onShowSafetyNumber,
      timerOptions,
      onBlockUser,
      onUnblockUser,
    } = this.props;

    if (isPublic || isRss) {
      return null;
    }

    const disappearingTitle = i18n('disappearingMessages') as any;

    const blockTitle = isBlocked ? i18n('unblockUser') : i18n('blockUser');
    const blockHandler = isBlocked ? onUnblockUser : onBlockUser;

    const disappearingMessagesMenuItem = !isKickedFromGroup && !isBlocked && (
      <SubMenu title={disappearingTitle}>
        {(timerOptions || []).map(item => (
          <MenuItem
            key={item.value}
            onClick={() => {
              onSetDisappearingMessages(item.value);
            }}
          >
            {item.name}
          </MenuItem>
        ))}
      </SubMenu>
    );
    const showMembersMenuItem = isGroup && (
      <MenuItem onClick={onShowGroupMembers}>{i18n('showMembers')}</MenuItem>
    );

    const showSafetyNumberMenuItem = !isGroup && !isMe && (
      <MenuItem onClick={onShowSafetyNumber}>
        {i18n('showSafetyNumber')}
      </MenuItem>
    );
    const resetSessionMenuItem = !isGroup && (
      <MenuItem onClick={onResetSession}>{i18n('resetSession')}</MenuItem>
    );
    const blockHandlerMenuItem = !isMe && !isRss && (
      <MenuItem onClick={blockHandler}>{blockTitle}</MenuItem>
    );

    return (
      <React.Fragment>
        {disappearingMessagesMenuItem}
        {showMembersMenuItem}
        {showSafetyNumberMenuItem}
        {resetSessionMenuItem}
        {blockHandlerMenuItem}
      </React.Fragment>
    );
  }
}
