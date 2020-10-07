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
  isPinned?: boolean;

  disableTimerChanges?: boolean;
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
  onSetPin: (value: boolean) => void;

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

  // Comes from a third-party dependency
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public menuTriggerRef: React.RefObject<any>;

  public constructor(props: PropsType) {
    super(props);

    this.menuTriggerRef = React.createRef();
    this.showMenuBound = this.showMenu.bind(this);
  }

  public showMenu(event: React.MouseEvent<HTMLButtonElement>): void {
    if (this.menuTriggerRef.current) {
      this.menuTriggerRef.current.handleContextClick(event);
    }
  }

  public renderBackButton(): JSX.Element {
    const { i18n, onGoBack, showBackButton } = this.props;

    return (
      <button
        type="button"
        onClick={onGoBack}
        className={classNames(
          'module-conversation-header__back-icon',
          showBackButton ? 'module-conversation-header__back-icon--show' : null
        )}
        disabled={!showBackButton}
        aria-label={i18n('goBack')}
      />
    );
  }

  public renderTitle(): JSX.Element {
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

  public renderAvatar(): JSX.Element {
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

  public renderExpirationLength(): JSX.Element | null {
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

  public renderMoreButton(triggerId: string): JSX.Element {
    const { i18n, showBackButton } = this.props;

    return (
      <ContextMenuTrigger id={triggerId} ref={this.menuTriggerRef}>
        <button
          type="button"
          onClick={this.showMenuBound}
          className={classNames(
            'module-conversation-header__more-button',
            showBackButton
              ? null
              : 'module-conversation-header__more-button--show'
          )}
          disabled={showBackButton}
          aria-label={i18n('moreInfo')}
        />
      </ContextMenuTrigger>
    );
  }

  public renderSearchButton(): JSX.Element {
    const { i18n, onSearchInConversation, showBackButton } = this.props;

    return (
      <button
        type="button"
        onClick={onSearchInConversation}
        className={classNames(
          'module-conversation-header__search-button',
          showBackButton
            ? null
            : 'module-conversation-header__search-button--show'
        )}
        disabled={showBackButton}
        aria-label={i18n('search')}
      />
    );
  }

  public renderOutgoingAudioCallButton(): JSX.Element | null {
    const {
      i18n,
      isMe,
      onOutgoingAudioCallInConversation,
      showBackButton,
      type,
    } = this.props;

    if (type === 'group' || isMe) {
      return null;
    }

    return (
      <button
        type="button"
        onClick={onOutgoingAudioCallInConversation}
        className={classNames(
          'module-conversation-header__audio-calling-button',
          showBackButton
            ? null
            : 'module-conversation-header__audio-calling-button--show'
        )}
        disabled={showBackButton}
        aria-label={i18n('makeOutgoingCall')}
      />
    );
  }

  public renderOutgoingVideoCallButton(): JSX.Element | null {
    const { i18n, isMe, type } = this.props;

    if (type === 'group' || isMe) {
      return null;
    }

    const { onOutgoingVideoCallInConversation, showBackButton } = this.props;

    return (
      <button
        type="button"
        onClick={onOutgoingVideoCallInConversation}
        className={classNames(
          'module-conversation-header__video-calling-button',
          showBackButton
            ? null
            : 'module-conversation-header__video-calling-button--show'
        )}
        disabled={showBackButton}
        aria-label={i18n('makeOutgoingVideoCall')}
      />
    );
  }

  public renderMenu(triggerId: string): JSX.Element {
    const {
      disableTimerChanges,
      i18n,
      isAccepted,
      isMe,
      isPinned,
      type,
      isArchived,
      muteExpirationLabel,
      onDeleteMessages,
      onResetSession,
      onSetDisappearingMessages,
      onSetMuteNotifications,
      onShowAllMedia,
      onShowGroupMembers,
      onShowSafetyNumber,
      onArchive,
      onSetPin,
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const disappearingTitle = i18n('disappearingMessages') as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const muteTitle = i18n('muteNotificationsTitle') as any;
    const isGroup = type === 'group';

    return (
      <ContextMenu id={triggerId}>
        {disableTimerChanges ? null : (
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
        )}
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
        {isPinned ? (
          <MenuItem onClick={() => onSetPin(false)}>
            {i18n('unpinConversation')}
          </MenuItem>
        ) : (
          <MenuItem onClick={() => onSetPin(true)}>
            {i18n('pinConversation')}
          </MenuItem>
        )}
        <MenuItem onClick={onDeleteMessages}>{i18n('deleteMessages')}</MenuItem>
      </ContextMenu>
    );
  }

  public render(): JSX.Element {
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
