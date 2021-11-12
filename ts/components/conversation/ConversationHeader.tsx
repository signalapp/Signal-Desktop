// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';
import Measure from 'react-measure';
import classNames from 'classnames';
import {
  ContextMenu,
  ContextMenuTrigger,
  MenuItem,
  SubMenu,
} from 'react-contextmenu';

import { Emojify } from './Emojify';
import { DisappearingTimeDialog } from '../DisappearingTimeDialog';
import { Avatar, AvatarSize } from '../Avatar';
import { InContactsIcon } from '../InContactsIcon';

import type { LocalizerType, ThemeType } from '../../types/Util';
import type { ConversationType } from '../../state/ducks/conversations';
import type { BadgeType } from '../../badges/types';
import { getMuteOptions } from '../../util/getMuteOptions';
import * as expirationTimer from '../../util/expirationTimer';
import { missingCaseError } from '../../util/missingCaseError';
import { isInSystemContacts } from '../../util/isInSystemContacts';

export enum OutgoingCallButtonStyle {
  None,
  JustVideo,
  Both,
  Join,
}

export type PropsDataType = {
  badge?: BadgeType;
  conversationTitle?: string;
  isMissingMandatoryProfileSharing?: boolean;
  outgoingCallButtonStyle: OutgoingCallButtonStyle;
  showBackButton?: boolean;
  isSMSOnly?: boolean;
  theme: ThemeType;
} & Pick<
  ConversationType,
  | 'acceptedMessageRequest'
  | 'announcementsOnly'
  | 'areWeAdmin'
  | 'avatarPath'
  | 'canChangeTimer'
  | 'color'
  | 'expireTimer'
  | 'groupVersion'
  | 'id'
  | 'isArchived'
  | 'isMe'
  | 'isPinned'
  | 'isVerified'
  | 'left'
  | 'markedUnread'
  | 'muteExpiresAt'
  | 'name'
  | 'phoneNumber'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
  | 'type'
  | 'unblurredAvatarPath'
>;

export type PropsActionsType = {
  onSetMuteNotifications: (seconds: number) => void;
  onSetDisappearingMessages: (seconds: number) => void;
  onDeleteMessages: () => void;
  onSearchInConversation: () => void;
  onOutgoingAudioCallInConversation: () => void;
  onOutgoingVideoCallInConversation: () => void;
  onSetPin: (value: boolean) => void;

  onShowConversationDetails: () => void;
  onShowAllMedia: () => void;
  onShowGroupMembers: () => void;
  onGoBack: () => void;

  onArchive: () => void;
  onMarkUnread: () => void;
  onMoveToInbox: () => void;
};

export type PropsHousekeepingType = {
  i18n: LocalizerType;
};

export type PropsType = PropsDataType &
  PropsActionsType &
  PropsHousekeepingType;

enum ModalState {
  NothingOpen,
  CustomDisappearingTimeout,
}

type StateType = {
  isNarrow: boolean;
  modalState: ModalState;
};

const TIMER_ITEM_CLASS = 'module-ConversationHeader__disappearing-timer__item';

export class ConversationHeader extends React.Component<PropsType, StateType> {
  private showMenuBound: (event: React.MouseEvent<HTMLButtonElement>) => void;

  // Comes from a third-party dependency
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private menuTriggerRef: React.RefObject<any>;

  public headerRef: React.RefObject<HTMLDivElement>;

  public constructor(props: PropsType) {
    super(props);

    this.state = { isNarrow: false, modalState: ModalState.NothingOpen };

    this.menuTriggerRef = React.createRef();
    this.headerRef = React.createRef();
    this.showMenuBound = this.showMenu.bind(this);
  }

  private showMenu(event: React.MouseEvent<HTMLButtonElement>): void {
    if (this.menuTriggerRef.current) {
      this.menuTriggerRef.current.handleContextClick(event);
    }
  }

  private renderBackButton(): ReactNode {
    const { i18n, onGoBack, showBackButton } = this.props;

    return (
      <button
        type="button"
        onClick={onGoBack}
        className={classNames(
          'module-ConversationHeader__back-icon',
          showBackButton ? 'module-ConversationHeader__back-icon--show' : null
        )}
        disabled={!showBackButton}
        aria-label={i18n('goBack')}
      />
    );
  }

  private renderHeaderInfoTitle(): ReactNode {
    const { name, title, type, i18n, isMe } = this.props;

    if (isMe) {
      return (
        <div className="module-ConversationHeader__header__info__title">
          {i18n('noteToSelf')}
        </div>
      );
    }

    return (
      <div className="module-ConversationHeader__header__info__title">
        <Emojify text={title} />
        {isInSystemContacts({ name, type }) ? (
          <InContactsIcon
            className="module-ConversationHeader__header__info__title__in-contacts-icon"
            i18n={i18n}
            tooltipContainerRef={this.headerRef}
          />
        ) : null}
      </div>
    );
  }

  private renderHeaderInfoSubtitle(): ReactNode {
    const expirationNode = this.renderExpirationLength();
    const verifiedNode = this.renderVerifiedIcon();

    if (expirationNode || verifiedNode) {
      return (
        <div className="module-ConversationHeader__header__info__subtitle">
          {expirationNode}
          {verifiedNode}
        </div>
      );
    }

    return null;
  }

  private renderAvatar(): ReactNode {
    const {
      acceptedMessageRequest,
      avatarPath,
      badge,
      color,
      i18n,
      type,
      isMe,
      name,
      phoneNumber,
      profileName,
      sharedGroupNames,
      theme,
      title,
      unblurredAvatarPath,
    } = this.props;

    return (
      <span className="module-ConversationHeader__header__avatar">
        <Avatar
          acceptedMessageRequest={acceptedMessageRequest}
          avatarPath={avatarPath}
          badge={badge}
          color={color}
          conversationType={type}
          i18n={i18n}
          isMe={isMe}
          noteToSelf={isMe}
          title={title}
          name={name}
          phoneNumber={phoneNumber}
          profileName={profileName}
          sharedGroupNames={sharedGroupNames}
          size={AvatarSize.THIRTY_TWO}
          theme={theme}
          unblurredAvatarPath={unblurredAvatarPath}
        />
      </span>
    );
  }

  private renderExpirationLength(): ReactNode {
    const { i18n, expireTimer } = this.props;

    if (!expireTimer) {
      return null;
    }

    return (
      <div className="module-ConversationHeader__header__info__subtitle__expiration">
        {expirationTimer.format(i18n, expireTimer)}
      </div>
    );
  }

  private renderVerifiedIcon(): ReactNode {
    const { i18n, isVerified } = this.props;

    if (!isVerified) {
      return null;
    }

    return (
      <div className="module-ConversationHeader__header__info__subtitle__verified">
        {i18n('verified')}
      </div>
    );
  }

  private renderMoreButton(triggerId: string): ReactNode {
    const { i18n, showBackButton } = this.props;

    return (
      <ContextMenuTrigger id={triggerId} ref={this.menuTriggerRef}>
        <button
          type="button"
          onClick={this.showMenuBound}
          className={classNames(
            'module-ConversationHeader__button',
            'module-ConversationHeader__button--more',
            showBackButton ? null : 'module-ConversationHeader__button--show'
          )}
          disabled={showBackButton}
          aria-label={i18n('moreInfo')}
        />
      </ContextMenuTrigger>
    );
  }

  private renderSearchButton(): ReactNode {
    const { i18n, onSearchInConversation, showBackButton } = this.props;

    return (
      <button
        type="button"
        onClick={onSearchInConversation}
        className={classNames(
          'module-ConversationHeader__button',
          'module-ConversationHeader__button--search',
          showBackButton ? null : 'module-ConversationHeader__button--show'
        )}
        disabled={showBackButton}
        aria-label={i18n('search')}
      />
    );
  }

  private renderOutgoingCallButtons(): ReactNode {
    const {
      announcementsOnly,
      areWeAdmin,
      i18n,
      onOutgoingAudioCallInConversation,
      onOutgoingVideoCallInConversation,
      outgoingCallButtonStyle,
      showBackButton,
    } = this.props;
    const { isNarrow } = this.state;

    const videoButton = (
      <button
        aria-label={i18n('makeOutgoingVideoCall')}
        className={classNames(
          'module-ConversationHeader__button',
          'module-ConversationHeader__button--video',
          showBackButton ? null : 'module-ConversationHeader__button--show',
          !showBackButton && announcementsOnly && !areWeAdmin
            ? 'module-ConversationHeader__button--show-disabled'
            : undefined
        )}
        disabled={showBackButton}
        onClick={onOutgoingVideoCallInConversation}
        type="button"
      />
    );

    switch (outgoingCallButtonStyle) {
      case OutgoingCallButtonStyle.None:
        return null;
      case OutgoingCallButtonStyle.JustVideo:
        return videoButton;
      case OutgoingCallButtonStyle.Both:
        return (
          <>
            {videoButton}
            <button
              type="button"
              onClick={onOutgoingAudioCallInConversation}
              className={classNames(
                'module-ConversationHeader__button',
                'module-ConversationHeader__button--audio',
                showBackButton
                  ? null
                  : 'module-ConversationHeader__button--show'
              )}
              disabled={showBackButton}
              aria-label={i18n('makeOutgoingCall')}
            />
          </>
        );
      case OutgoingCallButtonStyle.Join:
        return (
          <button
            aria-label={i18n('joinOngoingCall')}
            className={classNames(
              'module-ConversationHeader__button',
              'module-ConversationHeader__button--join-call',
              showBackButton ? null : 'module-ConversationHeader__button--show'
            )}
            disabled={showBackButton}
            onClick={onOutgoingVideoCallInConversation}
            type="button"
          >
            {isNarrow ? null : i18n('joinOngoingCall')}
          </button>
        );
      default:
        throw missingCaseError(outgoingCallButtonStyle);
    }
  }

  private renderMenu(triggerId: string): ReactNode {
    const {
      acceptedMessageRequest,
      canChangeTimer,
      expireTimer,
      groupVersion,
      i18n,
      isArchived,
      isMissingMandatoryProfileSharing,
      isPinned,
      left,
      markedUnread,
      muteExpiresAt,
      onArchive,
      onDeleteMessages,
      onMarkUnread,
      onMoveToInbox,
      onSetDisappearingMessages,
      onSetMuteNotifications,
      onSetPin,
      onShowAllMedia,
      onShowConversationDetails,
      onShowGroupMembers,
      type,
    } = this.props;

    const muteOptions = getMuteOptions(muteExpiresAt, i18n);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const disappearingTitle = i18n('disappearingMessages') as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const muteTitle = i18n('muteNotificationsTitle') as any;
    const isGroup = type === 'group';

    const disableTimerChanges = Boolean(
      !canChangeTimer ||
        !acceptedMessageRequest ||
        left ||
        isMissingMandatoryProfileSharing
    );

    const hasGV2AdminEnabled = isGroup && groupVersion === 2;

    const isActiveExpireTimer = (value: number): boolean => {
      if (!expireTimer) {
        return value === 0;
      }

      // Custom time...
      if (value === -1) {
        return !expirationTimer.DEFAULT_DURATIONS_SET.has(expireTimer);
      }
      return value === expireTimer;
    };

    const expireDurations: ReadonlyArray<ReactNode> = [
      ...expirationTimer.DEFAULT_DURATIONS_IN_SECONDS,
      -1,
    ].map((seconds: number) => {
      let text: string;

      if (seconds === -1) {
        text = i18n('customDisappearingTimeOption');
      } else {
        text = expirationTimer.format(i18n, seconds, {
          capitalizeOff: true,
        });
      }

      const onDurationClick = () => {
        if (seconds === -1) {
          this.setState({
            modalState: ModalState.CustomDisappearingTimeout,
          });
        } else {
          onSetDisappearingMessages(seconds);
        }
      };

      return (
        <MenuItem key={seconds} onClick={onDurationClick}>
          <div
            className={classNames(
              TIMER_ITEM_CLASS,
              isActiveExpireTimer(seconds) && `${TIMER_ITEM_CLASS}--active`
            )}
          >
            {text}
          </div>
        </MenuItem>
      );
    });

    return (
      <ContextMenu id={triggerId}>
        {disableTimerChanges ? null : (
          <SubMenu hoverDelay={1} title={disappearingTitle}>
            {expireDurations}
          </SubMenu>
        )}
        <SubMenu hoverDelay={1} title={muteTitle}>
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
        {!isGroup || hasGV2AdminEnabled ? (
          <MenuItem onClick={onShowConversationDetails}>
            {isGroup
              ? i18n('showConversationDetails')
              : i18n('showConversationDetails--direct')}
          </MenuItem>
        ) : null}
        {isGroup && !hasGV2AdminEnabled ? (
          <MenuItem onClick={onShowGroupMembers}>
            {i18n('showMembers')}
          </MenuItem>
        ) : null}
        <MenuItem onClick={onShowAllMedia}>{i18n('viewRecentMedia')}</MenuItem>
        <MenuItem divider />
        {!markedUnread ? (
          <MenuItem onClick={onMarkUnread}>{i18n('markUnread')}</MenuItem>
        ) : null}
        {isArchived ? (
          <MenuItem onClick={onMoveToInbox}>
            {i18n('moveConversationToInbox')}
          </MenuItem>
        ) : (
          <MenuItem onClick={onArchive}>{i18n('archiveConversation')}</MenuItem>
        )}
        <MenuItem onClick={onDeleteMessages}>{i18n('deleteMessages')}</MenuItem>
        {isPinned ? (
          <MenuItem onClick={() => onSetPin(false)}>
            {i18n('unpinConversation')}
          </MenuItem>
        ) : (
          <MenuItem onClick={() => onSetPin(true)}>
            {i18n('pinConversation')}
          </MenuItem>
        )}
      </ContextMenu>
    );
  }

  private renderHeader(): ReactNode {
    const { conversationTitle, groupVersion, onShowConversationDetails, type } =
      this.props;

    if (conversationTitle !== undefined) {
      return (
        <div className="module-ConversationHeader__header">
          <div className="module-ConversationHeader__header__info">
            <div className="module-ConversationHeader__header__info__title">
              {conversationTitle}
            </div>
          </div>
        </div>
      );
    }

    let onClick: undefined | (() => void);
    switch (type) {
      case 'direct':
        onClick = () => {
          onShowConversationDetails();
        };
        break;
      case 'group': {
        const hasGV2AdminEnabled = groupVersion === 2;
        onClick = hasGV2AdminEnabled
          ? () => {
              onShowConversationDetails();
            }
          : undefined;
        break;
      }
      default:
        throw missingCaseError(type);
    }

    const contents = (
      <>
        {this.renderAvatar()}
        <div className="module-ConversationHeader__header__info">
          {this.renderHeaderInfoTitle()}
          {this.renderHeaderInfoSubtitle()}
        </div>
      </>
    );

    if (onClick) {
      return (
        <button
          type="button"
          className="module-ConversationHeader__header module-ConversationHeader__header--clickable"
          onClick={onClick}
        >
          {contents}
        </button>
      );
    }

    return (
      <div className="module-ConversationHeader__header" ref={this.headerRef}>
        {contents}
      </div>
    );
  }

  public override render(): ReactNode {
    const { id, isSMSOnly, i18n, onSetDisappearingMessages, expireTimer } =
      this.props;
    const { isNarrow, modalState } = this.state;
    const triggerId = `conversation-${id}`;

    let modalNode: ReactNode;
    if (modalState === ModalState.NothingOpen) {
      modalNode = undefined;
    } else if (modalState === ModalState.CustomDisappearingTimeout) {
      modalNode = (
        <DisappearingTimeDialog
          i18n={i18n}
          initialValue={expireTimer}
          onSubmit={value => {
            this.setState({ modalState: ModalState.NothingOpen });
            onSetDisappearingMessages(value);
          }}
          onClose={() => this.setState({ modalState: ModalState.NothingOpen })}
        />
      );
    } else {
      throw missingCaseError(modalState);
    }

    return (
      <>
        {modalNode}
        <Measure
          bounds
          onResize={({ bounds }) => {
            if (!bounds || !bounds.width) {
              return;
            }
            this.setState({ isNarrow: bounds.width < 500 });
          }}
        >
          {({ measureRef }) => (
            <div
              className={classNames('module-ConversationHeader', {
                'module-ConversationHeader--narrow': isNarrow,
              })}
              ref={measureRef}
            >
              {this.renderBackButton()}
              {this.renderHeader()}
              {!isSMSOnly && this.renderOutgoingCallButtons()}
              {this.renderSearchButton()}
              {this.renderMoreButton(triggerId)}
              {this.renderMenu(triggerId)}
            </div>
          )}
        </Measure>
      </>
    );
  }
}
