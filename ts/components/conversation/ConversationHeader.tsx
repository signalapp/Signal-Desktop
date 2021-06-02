// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactNode } from 'react';
import Measure from 'react-measure';
import moment from 'moment';
import classNames from 'classnames';
import {
  ContextMenu,
  ContextMenuTrigger,
  MenuItem,
  SubMenu,
} from 'react-contextmenu';

import { Emojify } from './Emojify';
import { DisappearingTimeDialog } from './DisappearingTimeDialog';
import { Avatar, AvatarSize } from '../Avatar';
import { InContactsIcon } from '../InContactsIcon';

import { LocalizerType } from '../../types/Util';
import { ConversationType } from '../../state/ducks/conversations';
import { MuteOption, getMuteOptions } from '../../util/getMuteOptions';
import * as expirationTimer from '../../util/expirationTimer';
import { isMuted } from '../../util/isMuted';
import { missingCaseError } from '../../util/missingCaseError';
import { isInSystemContacts } from '../../util/isInSystemContacts';

export enum OutgoingCallButtonStyle {
  None,
  JustVideo,
  Both,
  Join,
}

export type PropsDataType = {
  conversationTitle?: string;
  isMissingMandatoryProfileSharing?: boolean;
  outgoingCallButtonStyle: OutgoingCallButtonStyle;
  showBackButton?: boolean;
  isSMSOnly?: boolean;
} & Pick<
  ConversationType,
  | 'acceptedMessageRequest'
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
  onShowContactModal: (contactId: string) => void;
  onDeleteMessages: () => void;
  onResetSession: () => void;
  onSearchInConversation: () => void;
  onOutgoingAudioCallInConversation: () => void;
  onOutgoingVideoCallInConversation: () => void;
  onSetPin: (value: boolean) => void;

  onShowChatColorEditor: () => void;
  onShowConversationDetails: () => void;
  onShowSafetyNumber: () => void;
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

  public constructor(props: PropsType) {
    super(props);

    this.state = { isNarrow: false, modalState: ModalState.NothingOpen };

    this.menuTriggerRef = React.createRef();
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
      color,
      i18n,
      type,
      isMe,
      name,
      phoneNumber,
      profileName,
      sharedGroupNames,
      title,
      unblurredAvatarPath,
    } = this.props;

    return (
      <span className="module-ConversationHeader__header__avatar">
        <Avatar
          acceptedMessageRequest={acceptedMessageRequest}
          avatarPath={avatarPath}
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
      i18n,
      onOutgoingAudioCallInConversation,
      onOutgoingVideoCallInConversation,
      outgoingCallButtonStyle,
      showBackButton,
    } = this.props;
    const { isNarrow } = this.state;

    const videoButton = (
      <button
        type="button"
        onClick={onOutgoingVideoCallInConversation}
        className={classNames(
          'module-ConversationHeader__button',
          'module-ConversationHeader__button--video',
          showBackButton ? null : 'module-ConversationHeader__button--show'
        )}
        disabled={showBackButton}
        aria-label={i18n('makeOutgoingVideoCall')}
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
            type="button"
            onClick={onOutgoingVideoCallInConversation}
            className={classNames(
              'module-ConversationHeader__button',
              'module-ConversationHeader__button--join-call',
              showBackButton ? null : 'module-ConversationHeader__button--show'
            )}
            disabled={showBackButton}
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
      i18n,
      acceptedMessageRequest,
      canChangeTimer,
      expireTimer,
      isArchived,
      isMe,
      isPinned,
      type,
      markedUnread,
      muteExpiresAt,
      isMissingMandatoryProfileSharing,
      left,
      groupVersion,
      onDeleteMessages,
      onResetSession,
      onSetDisappearingMessages,
      onSetMuteNotifications,
      onShowAllMedia,
      onShowChatColorEditor,
      onShowConversationDetails,
      onShowGroupMembers,
      onShowSafetyNumber,
      onArchive,
      onMarkUnread,
      onSetPin,
      onMoveToInbox,
    } = this.props;

    const muteOptions: Array<MuteOption> = [];
    if (isMuted(muteExpiresAt)) {
      const expires = moment(muteExpiresAt);

      let muteExpirationLabel: string;
      if (Number(muteExpiresAt) >= Number.MAX_SAFE_INTEGER) {
        muteExpirationLabel = i18n('muteExpirationLabelAlways');
      } else {
        const muteExpirationUntil = moment().isSame(expires, 'day')
          ? expires.format('hh:mm A')
          : expires.format('M/D/YY, hh:mm A');

        muteExpirationLabel = i18n('muteExpirationLabel', [
          muteExpirationUntil,
        ]);
      }

      muteOptions.push(
        ...[
          {
            name: muteExpirationLabel,
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
          <SubMenu title={disappearingTitle}>{expireDurations}</SubMenu>
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
        {!isGroup ? (
          <MenuItem onClick={onShowChatColorEditor}>
            {i18n('showChatColorEditor')}
          </MenuItem>
        ) : null}
        {hasGV2AdminEnabled ? (
          <MenuItem onClick={onShowConversationDetails}>
            {i18n('showConversationDetails')}
          </MenuItem>
        ) : null}
        {isGroup && !hasGV2AdminEnabled ? (
          <MenuItem onClick={onShowGroupMembers}>
            {i18n('showMembers')}
          </MenuItem>
        ) : null}
        <MenuItem onClick={onShowAllMedia}>{i18n('viewRecentMedia')}</MenuItem>
        {!isGroup && !isMe ? (
          <MenuItem onClick={onShowSafetyNumber}>
            {i18n('showSafetyNumber')}
          </MenuItem>
        ) : null}
        {!isGroup && acceptedMessageRequest ? (
          <MenuItem onClick={onResetSession}>{i18n('resetSession')}</MenuItem>
        ) : null}
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
    const {
      conversationTitle,
      groupVersion,
      id,
      isMe,
      onShowContactModal,
      onShowConversationDetails,
      type,
    } = this.props;

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
        onClick = isMe
          ? undefined
          : () => {
              onShowContactModal(id);
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

    return <div className="module-ConversationHeader__header">{contents}</div>;
  }

  public render(): ReactNode {
    const {
      id,
      isSMSOnly,
      i18n,
      onSetDisappearingMessages,
      expireTimer,
    } = this.props;
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
