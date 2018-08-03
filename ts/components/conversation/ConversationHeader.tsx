import React from 'react';
import classNames from 'classnames';

import { Emojify } from './Emojify';
import { Localizer } from '../../types/Util';
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

interface Trigger {
  handleContextClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}

interface Props {
  i18n: Localizer;
  isVerified: boolean;
  name?: string;
  id: string;
  phoneNumber: string;
  profileName?: string;
  color: string;

  avatarPath?: string;
  isMe: boolean;
  isGroup: boolean;
  expirationSettingName?: string;
  showBackButton: boolean;
  timerOptions: Array<TimerOption>;

  onSetDisappearingMessages: (seconds: number) => void;
  onDeleteMessages: () => void;
  onResetSession: () => void;

  onShowSafetyNumber: () => void;
  onShowAllMedia: () => void;
  onShowGroupMembers: () => void;
  onGoBack: () => void;
}

function getInitial(name: string): string {
  return name.trim()[0] || '#';
}

export class ConversationHeader extends React.Component<Props> {
  public captureMenuTriggerBound: (trigger: any) => void;
  public showMenuBound: (event: React.MouseEvent<HTMLDivElement>) => void;
  public menuTriggerRef: Trigger | null;

  public constructor(props: Props) {
    super(props);

    this.captureMenuTriggerBound = this.captureMenuTrigger.bind(this);
    this.showMenuBound = this.showMenu.bind(this);
    this.menuTriggerRef = null;
  }

  public captureMenuTrigger(triggerRef: Trigger) {
    this.menuTriggerRef = triggerRef;
  }
  public showMenu(event: React.MouseEvent<HTMLDivElement>) {
    if (this.menuTriggerRef) {
      this.menuTriggerRef.handleContextClick(event);
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
    const { name, phoneNumber, i18n, profileName, isVerified } = this.props;

    return (
      <div className="module-conversation-header__title">
        {name ? <Emojify text={name} i18n={i18n} /> : null}
        {name && phoneNumber ? ' · ' : null}
        {phoneNumber ? phoneNumber : null}{' '}
        {profileName && !name ? (
          <span className="module-conversation-header__title__profile-name">
            ~<Emojify text={profileName} i18n={i18n} />
          </span>
        ) : null}
        {isVerified ? ' · ' : null}
        {isVerified ? (
          <span>
            <span className="module-conversation-header__title__verified-icon" />
            {i18n('verified')}
          </span>
        ) : null}
      </div>
    );
  }

  public renderAvatar() {
    const {
      avatarPath,
      color,
      i18n,
      name,
      phoneNumber,
      profileName,
    } = this.props;

    if (!avatarPath) {
      const initial = getInitial(name || '');

      return (
        <div
          className={classNames(
            'module-conversation-header___avatar',
            'module-conversation-header___default-avatar',
            `module-conversation-header___default-avatar--${color}`
          )}
        >
          {initial}
        </div>
      );
    }

    const title = `${name || phoneNumber}${
      !name && profileName ? ` ~${profileName}` : ''
    }`;

    return (
      <img
        className="module-conversation-header___avatar"
        alt={i18n('contactAvatarAlt', [title])}
        src={avatarPath}
      />
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
      <ContextMenuTrigger id={triggerId} ref={this.captureMenuTriggerBound}>
        <div
          role="button"
          onClick={this.showMenuBound}
          className="module-conversation-header__gear-icon"
        />
      </ContextMenuTrigger>
    );
  }

  /* tslint:disable:jsx-no-lambda react-this-binding-issue */
  public renderMenu(triggerId: string) {
    const {
      i18n,
      isMe,
      isGroup,
      onDeleteMessages,
      onResetSession,
      onSetDisappearingMessages,
      onShowAllMedia,
      onShowGroupMembers,
      onShowSafetyNumber,
      timerOptions,
    } = this.props;

    const disappearingTitle = i18n('disappearingMessages') as any;

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
        <MenuItem onClick={onShowAllMedia}>{i18n('viewAllMedia')}</MenuItem>
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
        <MenuItem onClick={onDeleteMessages}>{i18n('deleteMessages')}</MenuItem>
      </ContextMenu>
    );
  }
  /* tslint:enable */

  public render() {
    const { id } = this.props;

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
        {this.renderGear(id)}
        {this.renderMenu(id)}
      </div>
    );
  }
}
