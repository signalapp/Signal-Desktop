import React from 'react';

import { ContactName } from './ContactName';
import { Avatar } from '../Avatar';
import { Colors, LocalizerType } from '../../types/Util';
import {
  ContextMenu,
  ContextMenuTrigger,
  MenuItem,
  SubMenu,
} from 'react-contextmenu';

interface TimerOption {
  name: string;
  value: number;
}

interface Props {
  id: string;
  name?: string;

  phoneNumber: string;
  profileName?: string;
  color: string;
  avatarPath?: string;

  isVerified: boolean;
  isMe: boolean;
  isClosable?: boolean;
  isGroup: boolean;
  isArchived: boolean;

  expirationSettingName?: string;
  showBackButton: boolean;
  timerOptions: Array<TimerOption>;
  hasNickname?: boolean;

  isBlocked: boolean;
  isKeysPending: boolean;
  isOnline?: boolean;

  onSetDisappearingMessages: (seconds: number) => void;
  onDeleteMessages: () => void;
  onDeleteContact: () => void;
  onResetSession: () => void;

  onArchive: () => void;
  onMoveToInbox: () => void;

  onShowSafetyNumber: () => void;
  onShowAllMedia: () => void;
  onShowGroupMembers: () => void;
  onGoBack: () => void;

  onBlockUser: () => void;
  onUnblockUser: () => void;

  onClearNickname: () => void;
  onChangeNickname: () => void;

  onCopyPublicKey: () => void;

  i18n: LocalizerType;
}

export class ConversationHeader extends React.Component<Props> {
  public showMenuBound: (event: React.MouseEvent<HTMLDivElement>) => void;
  public menuTriggerRef: React.RefObject<any>;

  public constructor(props: Props) {
    super(props);

    this.menuTriggerRef = React.createRef();
    this.showMenuBound = this.showMenu.bind(this);
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
      isKeysPending,
      isMe,
      name,
    } = this.props;

    if (isMe) {
      return (
        <div className="module-conversation-header__title">
          {i18n('noteToSelf')}
        </div>
      );
    }

    return (
      <div className="module-conversation-header__title">
        <ContactName
          phoneNumber={phoneNumber}
          profileName={profileName}
          name={name}
          i18n={i18n}
        />
        {isKeysPending ? '(pending)' : null}
      </div>
    );
  }

  public renderAvatar() {
    const {
      avatarPath,
      color,
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
          color={color}
          conversationType={conversationType}
          i18n={i18n}
          noteToSelf={isMe}
          name={name}
          phoneNumber={phoneNumber}
          profileName={profileName}
          size={28}
          borderColor={borderColor}
          borderWidth={2}
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

  public renderGear(triggerId: string) {
    const { showBackButton } = this.props;

    if (showBackButton) {
      return null;
    }

    return (
      <ContextMenuTrigger id={triggerId} ref={this.menuTriggerRef}>
        <div
          role="button"
          onClick={this.showMenuBound}
          className="module-conversation-header__gear-icon"
        />
      </ContextMenuTrigger>
    );
  }

  public renderMenu(triggerId: string) {
    const {
      i18n,
      isBlocked,
      isMe,
      isClosable,
      isGroup,
      isArchived,
      onDeleteMessages,
      onDeleteContact,
      onResetSession,
      onSetDisappearingMessages,
      // onShowAllMedia,
      onShowGroupMembers,
      onShowSafetyNumber,
      onArchive,
      onMoveToInbox,
      timerOptions,
      onBlockUser,
      onUnblockUser,
      hasNickname,
      onClearNickname,
      onChangeNickname,
      onCopyPublicKey,
    } = this.props;

    const disappearingTitle = i18n('disappearingMessages') as any;

    const blockTitle = isBlocked ? i18n('unblockUser') : i18n('blockUser');
    const blockHandler = isBlocked ? onUnblockUser : onBlockUser;

    return (
      <ContextMenu id={triggerId}>
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
        {/* <MenuItem onClick={onShowAllMedia}>{i18n('viewAllMedia')}</MenuItem> */}
        {isGroup ? (
          <MenuItem onClick={onShowGroupMembers}>
            {i18n('showMembers')}
          </MenuItem>
        ) : null}
        {!isGroup && !isMe ? (
          <MenuItem onClick={onShowSafetyNumber}>
            {i18n('showSafetyNumber')}
          </MenuItem>
        ) : null}
        {!isGroup ? (
          <MenuItem onClick={onResetSession}>{i18n('resetSession')}</MenuItem>
        ) : null}
        {/* Only show the block on other conversations */}
        {!isMe ? (
          <MenuItem onClick={blockHandler}>{blockTitle}</MenuItem>
        ) : null}
        {!isMe ? (
          <MenuItem onClick={onChangeNickname}>
            {i18n('changeNickname')}
          </MenuItem>
        ) : null}
        {!isMe && hasNickname ? (
          <MenuItem onClick={onClearNickname}>{i18n('clearNickname')}</MenuItem>
        ) : null}
        <MenuItem onClick={onCopyPublicKey}>{i18n('copyPublicKey')}</MenuItem>
        {isArchived ? (
          <MenuItem onClick={onMoveToInbox}>
            {i18n('moveConversationToInbox')}
          </MenuItem>
        ) : (
          <MenuItem onClick={onArchive}>{i18n('archiveConversation')}</MenuItem>
        )}
        <MenuItem onClick={onDeleteMessages}>{i18n('deleteMessages')}</MenuItem>
        {!isMe && isClosable ? (
          <MenuItem onClick={onDeleteContact}>{i18n('deleteContact')}</MenuItem>
        ) : null}
      </ContextMenu>
    );
  }

  public render() {
    const { id } = this.props;
    const triggerId = `conversation-${id}`;

    return (
      <div className="module-conversation-header">
        {this.renderBackButton()}
        <div className="module-conversation-header__title-container">
          <div className="module-conversation-header__title-flex">
            {this.renderAvatar()}
            {this.renderTitle()}
          </div>
        </div>
        {this.renderExpirationLength()}
        {this.renderGear(triggerId)}
        {this.renderMenu(triggerId)}
      </div>
    );
  }
}
