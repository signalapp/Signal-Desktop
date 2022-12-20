// Copyright 2018-2022 Signal Messenger, LLC
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
import type {
  ConversationType,
  PushPanelForConversationActionType,
} from '../../state/ducks/conversations';
import type { BadgeType } from '../../badges/types';
import type { HasStories } from '../../types/Stories';
import type { ViewUserStoriesActionCreatorType } from '../../state/ducks/stories';
import { StoryViewModeType } from '../../types/Stories';
import { getMuteOptions } from '../../util/getMuteOptions';
import * as expirationTimer from '../../util/expirationTimer';
import { missingCaseError } from '../../util/missingCaseError';
import { isInSystemContacts } from '../../util/isInSystemContacts';
import { isConversationMuted } from '../../util/isConversationMuted';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { DurationInSeconds } from '../../util/durations';
import {
  useStartCallShortcuts,
  useKeyboardShortcuts,
} from '../../hooks/useKeyboardShortcuts';
import { PanelType } from '../../types/Panels';

export enum OutgoingCallButtonStyle {
  None,
  JustVideo,
  Both,
  Join,
}

export type PropsDataType = {
  badge?: BadgeType;
  conversationTitle?: string;
  hasStories?: HasStories;
  isMissingMandatoryProfileSharing?: boolean;
  outgoingCallButtonStyle: OutgoingCallButtonStyle;
  showBackButton?: boolean;
  isSMSOnly?: boolean;
  isSignalConversation?: boolean;
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
  destroyMessages: (conversationId: string) => void;
  onArchive: () => void;
  onGoBack: () => void;
  onMarkUnread: () => void;
  onMoveToInbox: () => void;
  onOutgoingAudioCallInConversation: (conversationId: string) => void;
  onOutgoingVideoCallInConversation: (conversationId: string) => void;
  onSearchInConversation: () => void;
  pushPanelForConversation: PushPanelForConversationActionType;
  setDisappearingMessages: (
    conversationId: string,
    seconds: DurationInSeconds
  ) => void;
  setMuteExpiration: (conversationId: string, seconds: number) => void;
  setPinned: (conversationId: string, value: boolean) => void;
  viewUserStories: ViewUserStoriesActionCreatorType;
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
  hasDeleteMessagesConfirmation: boolean;
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

    this.state = {
      hasDeleteMessagesConfirmation: false,
      isNarrow: false,
      modalState: ModalState.NothingOpen,
    };

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
      hasStories,
      id,
      i18n,
      type,
      isMe,
      phoneNumber,
      profileName,
      sharedGroupNames,
      theme,
      title,
      unblurredAvatarPath,
      viewUserStories,
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
          onClick={
            hasStories
              ? () => {
                  viewUserStories({
                    conversationId: id,
                    storyViewMode: StoryViewModeType.User,
                  });
                }
              : undefined
          }
          phoneNumber={phoneNumber}
          profileName={profileName}
          sharedGroupNames={sharedGroupNames}
          size={AvatarSize.THIRTY_TWO}
          // user may have stories, but we don't show that on Note to Self conversation
          storyRing={isMe ? undefined : hasStories}
          theme={theme}
          title={title}
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

  private renderMenu(triggerId: string): ReactNode {
    const {
      acceptedMessageRequest,
      canChangeTimer,
      expireTimer,
      groupVersion,
      i18n,
      id,
      isArchived,
      isMissingMandatoryProfileSharing,
      isPinned,
      isSignalConversation,
      left,
      markedUnread,
      muteExpiresAt,
      onArchive,
      onMarkUnread,
      onMoveToInbox,
      pushPanelForConversation,
      setDisappearingMessages,
      setMuteExpiration,
      setPinned,
      type,
    } = this.props;

    const muteOptions = getMuteOptions(muteExpiresAt, i18n);

    const muteTitle = <span>{i18n('muteNotificationsTitle')}</span>;

    if (isSignalConversation) {
      const isMuted = muteExpiresAt && isConversationMuted({ muteExpiresAt });

      return (
        <ContextMenu id={triggerId}>
          <SubMenu hoverDelay={1} title={muteTitle} rtl>
            {isMuted ? (
              <MenuItem
                onClick={() => {
                  setMuteExpiration(id, 0);
                }}
              >
                {i18n('unmute')}
              </MenuItem>
            ) : (
              <MenuItem
                onClick={() => {
                  setMuteExpiration(id, Number.MAX_SAFE_INTEGER);
                }}
              >
                {i18n('muteAlways')}
              </MenuItem>
            )}
          </SubMenu>
        </ContextMenu>
      );
    }

    const disappearingTitle = <span>{i18n('icu:disappearingMessages')}</span>;
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
      DurationInSeconds.fromSeconds(-1),
    ].map(seconds => {
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
          setDisappearingMessages(id, seconds);
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
          <SubMenu hoverDelay={1} title={disappearingTitle} rtl>
            {expireDurations}
          </SubMenu>
        )}
        <SubMenu hoverDelay={1} title={muteTitle} rtl>
          {muteOptions.map(item => (
            <MenuItem
              key={item.name}
              disabled={item.disabled}
              onClick={() => {
                setMuteExpiration(id, item.value);
              }}
            >
              {item.name}
            </MenuItem>
          ))}
        </SubMenu>
        {!isGroup || hasGV2AdminEnabled ? (
          <MenuItem
            onClick={() =>
              pushPanelForConversation(id, {
                type: PanelType.ConversationDetails,
              })
            }
          >
            {isGroup
              ? i18n('showConversationDetails')
              : i18n('showConversationDetails--direct')}
          </MenuItem>
        ) : null}
        {isGroup && !hasGV2AdminEnabled ? (
          <MenuItem
            onClick={() =>
              pushPanelForConversation(id, { type: PanelType.GroupV1Members })
            }
          >
            {i18n('showMembers')}
          </MenuItem>
        ) : null}
        <MenuItem
          onClick={() =>
            pushPanelForConversation(id, { type: PanelType.AllMedia })
          }
        >
          {i18n('viewRecentMedia')}
        </MenuItem>
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
        <MenuItem
          onClick={() => this.setState({ hasDeleteMessagesConfirmation: true })}
        >
          {i18n('deleteMessages')}
        </MenuItem>
        {isPinned ? (
          <MenuItem onClick={() => setPinned(id, false)}>
            {i18n('unpinConversation')}
          </MenuItem>
        ) : (
          <MenuItem onClick={() => setPinned(id, true)}>
            {i18n('pinConversation')}
          </MenuItem>
        )}
      </ContextMenu>
    );
  }

  private renderConfirmationDialog(): ReactNode {
    const { hasDeleteMessagesConfirmation } = this.state;
    const { destroyMessages, i18n, id } = this.props;

    if (!hasDeleteMessagesConfirmation) {
      return;
    }

    return (
      <ConfirmationDialog
        dialogName="ConversationHeader.destroyMessages"
        actions={[
          {
            action: () => {
              this.setState({ hasDeleteMessagesConfirmation: false });
              destroyMessages(id);
            },
            style: 'negative',
            text: i18n('delete'),
          },
        ]}
        i18n={i18n}
        onClose={() => {
          this.setState({ hasDeleteMessagesConfirmation: false });
        }}
      >
        {i18n('deleteConversationConfirmation')}
      </ConfirmationDialog>
    );
  }

  private renderHeader(): ReactNode {
    const {
      conversationTitle,
      id,
      groupVersion,
      pushPanelForConversation,
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
        onClick = () => {
          pushPanelForConversation(id, { type: PanelType.ConversationDetails });
        };
        break;
      case 'group': {
        const hasGV2AdminEnabled = groupVersion === 2;
        onClick = hasGV2AdminEnabled
          ? () => {
              pushPanelForConversation(id, {
                type: PanelType.ConversationDetails,
              });
            }
          : undefined;
        break;
      }
      default:
        throw missingCaseError(type);
    }

    const avatar = this.renderAvatar();
    const contents = (
      <div className="module-ConversationHeader__header__info">
        {this.renderHeaderInfoTitle()}
        {this.renderHeaderInfoSubtitle()}
      </div>
    );

    if (onClick) {
      return (
        <div className="module-ConversationHeader__header">
          {avatar}
          <button
            type="button"
            className="module-ConversationHeader__header--clickable"
            onClick={onClick}
          >
            {contents}
          </button>
        </div>
      );
    }

    return (
      <div className="module-ConversationHeader__header" ref={this.headerRef}>
        {avatar}
        {contents}
      </div>
    );
  }

  public override render(): ReactNode {
    const {
      announcementsOnly,
      areWeAdmin,
      expireTimer,
      i18n,
      id,
      isSMSOnly,
      isSignalConversation,
      onOutgoingAudioCallInConversation,
      onOutgoingVideoCallInConversation,
      outgoingCallButtonStyle,
      setDisappearingMessages,
      showBackButton,
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
            setDisappearingMessages(id, value);
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
        {this.renderConfirmationDialog()}
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
              {!isSMSOnly && !isSignalConversation && (
                <OutgoingCallButtons
                  announcementsOnly={announcementsOnly}
                  areWeAdmin={areWeAdmin}
                  i18n={i18n}
                  id={id}
                  isNarrow={isNarrow}
                  onOutgoingAudioCallInConversation={
                    onOutgoingAudioCallInConversation
                  }
                  onOutgoingVideoCallInConversation={
                    onOutgoingVideoCallInConversation
                  }
                  outgoingCallButtonStyle={outgoingCallButtonStyle}
                  showBackButton={showBackButton}
                />
              )}
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

function OutgoingCallButtons({
  announcementsOnly,
  areWeAdmin,
  i18n,
  id,
  isNarrow,
  onOutgoingAudioCallInConversation,
  onOutgoingVideoCallInConversation,
  outgoingCallButtonStyle,
  showBackButton,
}: { isNarrow: boolean } & Pick<
  PropsType,
  | 'announcementsOnly'
  | 'areWeAdmin'
  | 'i18n'
  | 'id'
  | 'onOutgoingAudioCallInConversation'
  | 'onOutgoingVideoCallInConversation'
  | 'outgoingCallButtonStyle'
  | 'showBackButton'
>): JSX.Element | null {
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
      onClick={() => onOutgoingVideoCallInConversation(id)}
      type="button"
    />
  );

  const startCallShortcuts = useStartCallShortcuts(
    () => onOutgoingAudioCallInConversation(id),
    () => onOutgoingVideoCallInConversation(id)
  );
  useKeyboardShortcuts(startCallShortcuts);

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
            onClick={() => onOutgoingAudioCallInConversation(id)}
            className={classNames(
              'module-ConversationHeader__button',
              'module-ConversationHeader__button--audio',
              showBackButton ? null : 'module-ConversationHeader__button--show'
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
          onClick={() => onOutgoingVideoCallInConversation(id)}
          type="button"
        >
          {isNarrow ? null : i18n('joinOngoingCall')}
        </button>
      );
    default:
      throw missingCaseError(outgoingCallButtonStyle);
  }
}
