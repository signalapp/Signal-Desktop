import React from 'react';
import classNames from 'classnames';
import {
  ContextMenu,
  ContextMenuTrigger,
  MenuItem,
  SubMenu,
} from 'react-contextmenu';

import { Emojify } from './Emojify';
import { Avatar } from '../Avatar';
import { InContactsIcon } from '../InContactsIcon';

import { LocalizerType } from '../../types/Util';
import { ColorType } from '../../types/Colors';
import { getMuteOptions } from '../../util/getMuteOptions';

interface TimerOption {
  name: string;
  value: number;
}

export interface PropsDataType {
  id: string;
  name?: string;

  phoneNumber?: string;
  profileName?: string;
  color?: ColorType;
  avatarPath?: string;
  type: 'direct' | 'group';
  title: string;

  isAccepted?: boolean;
  isVerified?: boolean;
  isMe?: boolean;
  isArchived?: boolean;
  leftGroup?: boolean;

  expirationSettingName?: string;
  muteExpirationLabel?: string;
  showBackButton?: boolean;
  timerOptions?: Array<TimerOption>;
}

export interface PropsActionsType {
  onSetMuteNotifications: (seconds: number) => void;
  onSetDisappearingMessages: (seconds: number) => void;
  onDeleteMessages: () => void;
  onResetSession: () => void;
  onSearchInConversation: () => void;
  onOutgoingAudioCallInConversation: () => void;
  onOutgoingVideoCallInConversation: () => void;

  onShowSafetyNumber: () => void;
  onShowAllMedia: () => void;
  onShowGroupMembers: () => void;
  onGoBack: () => void;

  onArchive: () => void;
  onMoveToInbox: () => void;
}

export interface PropsHousekeepingType {
  i18n: LocalizerType;
}

export type PropsType = PropsDataType &
  PropsActionsType &
  PropsHousekeepingType;

export class ConversationHeader extends React.Component<PropsType> {
  public showMenuBound: (event: React.MouseEvent<HTMLButtonElement>) => void;
  public menuTriggerRef: React.RefObject<any>;

  public constructor(props: PropsType) {
    super(props);

    this.menuTriggerRef = React.createRef();
    this.showMenuBound = this.showMenu.bind(this);
  }

  public showMenu(event: React.MouseEvent<HTMLButtonElement>) {
    if (this.menuTriggerRef.current) {
      this.menuTriggerRef.current.handleContextClick(event);
    }
  }

  public renderBackButton() {
    const { onGoBack, showBackButton } = this.props;

    return (
      <button
        onClick={onGoBack}
        className={classNames(
          'module-conversation-header__back-icon',
          showBackButton ? 'module-conversation-header__back-icon--show' : null
        )}
        disabled={!showBackButton}
      />
    );
  }

  public renderTitle() {
    const {
      name,
      phoneNumber,
      title,
      type,
      i18n,
      isMe,
      profileName,
      isVerified,
    } = this.props;

    if (isMe) {
      return (
        <div className="module-conversation-header__title">
          {i18n('noteToSelf')}
        </div>
      );
    }

    const shouldShowIcon = Boolean(name && type === 'direct');
    const shouldShowNumber = Boolean(phoneNumber && (name || profileName));

    return (
      <div className="module-conversation-header__title">
        <Emojify text={title} />
        {shouldShowIcon ? (
          <span>
            {' '}
            <InContactsIcon i18n={i18n} />
          </span>
        ) : null}
        {shouldShowNumber ? ` · ${phoneNumber}` : null}
        {isVerified ? (
          <span>
            {' · '}
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
      type,
      isMe,
      name,
      phoneNumber,
      profileName,
      title,
    } = this.props;

    return (
      <span className="module-conversation-header__avatar">
        <Avatar
          avatarPath={avatarPath}
          color={color}
          conversationType={type}
          i18n={i18n}
          noteToSelf={isMe}
          title={title}
          name={name}
          phoneNumber={phoneNumber}
          profileName={profileName}
          size={28}
        />
      </span>
    );
  }

  public renderExpirationLength() {
    const { expirationSettingName, showBackButton } = this.props;

    if (!expirationSettingName) {
      return null;
    }

    return (
      <div
        className={classNames(
          'module-conversation-header__expiration',
          showBackButton
            ? 'module-conversation-header__expiration--hidden'
            : null
        )}
      >
        <div className="module-conversation-header__expiration__clock-icon" />
        <div className="module-conversation-header__expiration__setting">
          {expirationSettingName}
        </div>
      </div>
    );
  }

  public renderMoreButton(triggerId: string) {
    const { showBackButton } = this.props;

    return (
      <ContextMenuTrigger id={triggerId} ref={this.menuTriggerRef}>
        <button
          onClick={this.showMenuBound}
          className={classNames(
            'module-conversation-header__more-button',
            showBackButton
              ? null
              : 'module-conversation-header__more-button--show'
          )}
          disabled={showBackButton}
        />
      </ContextMenuTrigger>
    );
  }

  public renderSearchButton() {
    const { onSearchInConversation, showBackButton } = this.props;

    return (
      <button
        onClick={onSearchInConversation}
        className={classNames(
          'module-conversation-header__search-button',
          showBackButton
            ? null
            : 'module-conversation-header__search-button--show'
        )}
        disabled={showBackButton}
      />
    );
  }

  public renderOutgoingAudioCallButton() {
    if (!window.CALLING) {
      return null;
    }
    if (this.props.type === 'group' || this.props.isMe) {
      return null;
    }

    const { onOutgoingAudioCallInConversation, showBackButton } = this.props;

    return (
      <button
        onClick={onOutgoingAudioCallInConversation}
        className={classNames(
          'module-conversation-header__audio-calling-button',
          showBackButton
            ? null
            : 'module-conversation-header__audio-calling-button--show'
        )}
        disabled={showBackButton}
      />
    );
  }

  public renderOutgoingVideoCallButton() {
    if (!window.CALLING) {
      return null;
    }
    if (this.props.type === 'group' || this.props.isMe) {
      return null;
    }

    const { onOutgoingVideoCallInConversation, showBackButton } = this.props;

    return (
      <button
        onClick={onOutgoingVideoCallInConversation}
        className={classNames(
          'module-conversation-header__video-calling-button',
          showBackButton
            ? null
            : 'module-conversation-header__video-calling-button--show'
        )}
        disabled={showBackButton}
      />
    );
  }

  public renderMenu(triggerId: string) {
    const {
      i18n,
      isAccepted,
      isMe,
      type,
      isArchived,
      leftGroup,
      muteExpirationLabel,
      onDeleteMessages,
      onResetSession,
      onSetDisappearingMessages,
      onSetMuteNotifications,
      onShowAllMedia,
      onShowGroupMembers,
      onShowSafetyNumber,
      onArchive,
      onMoveToInbox,
      timerOptions,
    } = this.props;

    const muteOptions = [];
    if (muteExpirationLabel) {
      muteOptions.push(
        ...[
          {
            name: i18n('muteExpirationLabel', [muteExpirationLabel]),
            disabled: true,
            value: 0,
          },
          {
            name: i18n('unmute'),
            value: 0,
          },
        ]
      );
    }
    muteOptions.push(...getMuteOptions(i18n));

    const disappearingTitle = i18n('disappearingMessages') as any;
    const muteTitle = i18n('muteNotificationsTitle') as any;
    const isGroup = type === 'group';

    return (
      <ContextMenu id={triggerId}>
        {!leftGroup && isAccepted ? (
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
        ) : null}
        <SubMenu title={muteTitle}>
          {muteOptions.map(item => (
            <MenuItem
              key={item.name}
              disabled={item.disabled}
              onClick={() => {
                onSetMuteNotifications(item.value);
              }}
            >
              {item.name}
            </MenuItem>
          ))}
        </SubMenu>
        <MenuItem onClick={onShowAllMedia}>{i18n('viewRecentMedia')}</MenuItem>
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
        {!isGroup && isAccepted ? (
          <MenuItem onClick={onResetSession}>{i18n('resetSession')}</MenuItem>
        ) : null}
        {isArchived ? (
          <MenuItem onClick={onMoveToInbox}>
            {i18n('moveConversationToInbox')}
          </MenuItem>
        ) : (
          <MenuItem onClick={onArchive}>{i18n('archiveConversation')}</MenuItem>
        )}
        <MenuItem onClick={onDeleteMessages}>{i18n('deleteMessages')}</MenuItem>
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
        {this.renderSearchButton()}
        {this.renderOutgoingVideoCallButton()}
        {this.renderOutgoingAudioCallButton()}
        {this.renderMoreButton(triggerId)}
        {this.renderMenu(triggerId)}
      </div>
    );
  }
}
