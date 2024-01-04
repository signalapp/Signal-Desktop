// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';
import classNames from 'classnames';
import {
  ContextMenu,
  ContextMenuTrigger,
  MenuItem,
  SubMenu,
} from 'react-contextmenu';

import { createPortal } from 'react-dom';
import { DisappearingTimeDialog } from '../DisappearingTimeDialog';
import { Avatar, AvatarSize } from '../Avatar';
import { InContactsIcon } from '../InContactsIcon';

import type { LocalizerType, ThemeType } from '../../types/Util';
import type {
  ConversationType,
  PopPanelForConversationActionType,
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
import { UserText } from '../UserText';
import { Alert } from '../Alert';
import { SizeObserver } from '../../hooks/useSizeObserver';

export enum OutgoingCallButtonStyle {
  None,
  JustVideo,
  Both,
  Join,
}

export type PropsDataType = {
  badge?: BadgeType;
  cannotLeaveBecauseYouAreLastAdmin: boolean;
  hasPanelShowing?: boolean;
  hasStories?: HasStories;
  isMissingMandatoryProfileSharing?: boolean;
  outgoingCallButtonStyle: OutgoingCallButtonStyle;
  isSMSOnly?: boolean;
  isSelectMode: boolean;
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
  leaveGroup: (conversationId: string) => void;
  onArchive: (conversationId: string) => void;
  onMarkUnread: (conversationId: string) => void;
  toggleSelectMode: (on: boolean) => void;
  onMoveToInbox: (conversationId: string) => void;
  onOutgoingAudioCallInConversation: (conversationId: string) => void;
  onOutgoingVideoCallInConversation: (conversationId: string) => void;
  pushPanelForConversation: PushPanelForConversationActionType;
  popPanelForConversation: PopPanelForConversationActionType;
  searchInConversation: (conversationId: string) => void;
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
  hasLeaveGroupConfirmation: boolean;
  hasCannotLeaveGroupBecauseYouAreLastAdminAlert: boolean;
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
      hasLeaveGroupConfirmation: false,
      hasCannotLeaveGroupBecauseYouAreLastAdminAlert: false,
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

  private renderHeaderInfoTitle(): ReactNode {
    const { name, title, type, i18n, isMe } = this.props;

    if (isMe) {
      return (
        <div className="module-ConversationHeader__header__info__title">
          {i18n('icu:noteToSelf')}
          <span className="ContactModal__official-badge" />
        </div>
      );
    }

    return (
      <div className="module-ConversationHeader__header__info__title">
        <UserText text={title} />
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

  private renderAvatar(onClickFallback: undefined | (() => void)): ReactNode {
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
              : onClickFallback
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
        {i18n('icu:verified')}
      </div>
    );
  }

  private renderMoreButton(triggerId: string): ReactNode {
    const { i18n, isSelectMode } = this.props;

    return (
      <ContextMenuTrigger
        id={triggerId}
        ref={this.menuTriggerRef}
        disable={isSelectMode}
      >
        <button
          type="button"
          onClick={this.showMenuBound}
          className={classNames(
            'module-ConversationHeader__button',
            'module-ConversationHeader__button--more'
          )}
          aria-label={i18n('icu:moreInfo')}
          disabled={isSelectMode}
        />
      </ContextMenuTrigger>
    );
  }

  private renderSearchButton(): ReactNode {
    const { i18n, id, searchInConversation } = this.props;

    return (
      <button
        type="button"
        onClick={() => searchInConversation(id)}
        className={classNames(
          'module-ConversationHeader__button',
          'module-ConversationHeader__button--search'
        )}
        aria-label={i18n('icu:search')}
      />
    );
  }

  private renderMenu(triggerId: string): ReactNode {
    const {
      acceptedMessageRequest,
      canChangeTimer,
      cannotLeaveBecauseYouAreLastAdmin,
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
      toggleSelectMode,
      isSelectMode,
      onMoveToInbox,
      pushPanelForConversation,
      setDisappearingMessages,
      setMuteExpiration,
      setPinned,
      type,
    } = this.props;

    if (isSelectMode) {
      return null;
    }

    const isRTL = i18n.getLocaleDirection() === 'rtl';

    const muteOptions = getMuteOptions(muteExpiresAt, i18n);

    const muteTitle = <span>{i18n('icu:muteNotificationsTitle')}</span>;

    if (isSignalConversation) {
      const isMuted = muteExpiresAt && isConversationMuted({ muteExpiresAt });

      return (
        <ContextMenu id={triggerId} rtl={isRTL}>
          <SubMenu hoverDelay={1} title={muteTitle} rtl={!isRTL}>
            {isMuted ? (
              <MenuItem
                onClick={() => {
                  setMuteExpiration(id, 0);
                }}
              >
                {i18n('icu:unmute')}
              </MenuItem>
            ) : (
              <MenuItem
                onClick={() => {
                  setMuteExpiration(id, Number.MAX_SAFE_INTEGER);
                }}
              >
                {i18n('icu:muteAlways')}
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

    if (isGroup && groupVersion !== 2) {
      return (
        <ContextMenu id={triggerId}>
          <MenuItem
            onClick={() =>
              pushPanelForConversation({ type: PanelType.GroupV1Members })
            }
          >
            {i18n('icu:showMembers')}
          </MenuItem>
          <MenuItem
            onClick={() =>
              pushPanelForConversation({ type: PanelType.AllMedia })
            }
          >
            {i18n('icu:viewRecentMedia')}
          </MenuItem>
          <MenuItem divider />
          {isArchived ? (
            <MenuItem onClick={() => onMoveToInbox(id)}>
              {i18n('icu:moveConversationToInbox')}
            </MenuItem>
          ) : (
            <MenuItem onClick={() => onArchive(id)}>
              {i18n('icu:archiveConversation')}
            </MenuItem>
          )}
          <MenuItem
            onClick={() =>
              this.setState({ hasDeleteMessagesConfirmation: true })
            }
          >
            {i18n('icu:deleteMessagesInConversation')}
          </MenuItem>
        </ContextMenu>
      );
    }

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
        text = i18n('icu:customDisappearingTimeOption');
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

    return createPortal(
      <ContextMenu id={triggerId} rtl={isRTL}>
        {disableTimerChanges ? null : (
          <SubMenu hoverDelay={1} title={disappearingTitle} rtl={!isRTL}>
            {expireDurations}
          </SubMenu>
        )}
        <SubMenu hoverDelay={1} title={muteTitle} rtl={!isRTL}>
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
              pushPanelForConversation({
                type: PanelType.ConversationDetails,
              })
            }
          >
            {isGroup
              ? i18n('icu:showConversationDetails')
              : i18n('icu:showConversationDetails--direct')}
          </MenuItem>
        ) : null}
        <MenuItem
          onClick={() => pushPanelForConversation({ type: PanelType.AllMedia })}
        >
          {i18n('icu:viewRecentMedia')}
        </MenuItem>
        <MenuItem divider />
        <MenuItem
          onClick={() => {
            toggleSelectMode(true);
          }}
        >
          {i18n('icu:ConversationHeader__menu__selectMessages')}
        </MenuItem>
        <MenuItem divider />
        {!markedUnread ? (
          <MenuItem onClick={() => onMarkUnread(id)}>
            {i18n('icu:markUnread')}
          </MenuItem>
        ) : null}
        {isPinned ? (
          <MenuItem onClick={() => setPinned(id, false)}>
            {i18n('icu:unpinConversation')}
          </MenuItem>
        ) : (
          <MenuItem onClick={() => setPinned(id, true)}>
            {i18n('icu:pinConversation')}
          </MenuItem>
        )}
        {isArchived ? (
          <MenuItem onClick={() => onMoveToInbox(id)}>
            {i18n('icu:moveConversationToInbox')}
          </MenuItem>
        ) : (
          <MenuItem onClick={() => onArchive(id)}>
            {i18n('icu:archiveConversation')}
          </MenuItem>
        )}
        <MenuItem
          onClick={() => this.setState({ hasDeleteMessagesConfirmation: true })}
        >
          {i18n('icu:deleteMessagesInConversation')}
        </MenuItem>
        {isGroup && (
          <MenuItem
            onClick={() => {
              if (cannotLeaveBecauseYouAreLastAdmin) {
                this.setState({
                  hasCannotLeaveGroupBecauseYouAreLastAdminAlert: true,
                });
              } else {
                this.setState({ hasLeaveGroupConfirmation: true });
              }
            }}
          >
            {i18n(
              'icu:ConversationHeader__ContextMenu__LeaveGroupAction__title'
            )}
          </MenuItem>
        )}
      </ContextMenu>,
      document.body
    );
  }

  private renderDeleteMessagesConfirmationDialog(): ReactNode {
    const { hasDeleteMessagesConfirmation } = this.state;
    const { destroyMessages, i18n, id } = this.props;

    if (!hasDeleteMessagesConfirmation) {
      return;
    }

    return (
      <ConfirmationDialog
        dialogName="ConversationHeader.destroyMessages"
        title={i18n(
          'icu:ConversationHeader__DeleteMessagesInConversationConfirmation__title'
        )}
        actions={[
          {
            action: () => {
              this.setState({ hasDeleteMessagesConfirmation: false });
              destroyMessages(id);
            },
            style: 'negative',
            text: i18n('icu:delete'),
          },
        ]}
        i18n={i18n}
        onClose={() => {
          this.setState({ hasDeleteMessagesConfirmation: false });
        }}
      >
        {i18n(
          'icu:ConversationHeader__DeleteMessagesInConversationConfirmation__description'
        )}
      </ConfirmationDialog>
    );
  }

  private renderLeaveGroupConfirmationDialog(): ReactNode {
    const { hasLeaveGroupConfirmation } = this.state;
    const { cannotLeaveBecauseYouAreLastAdmin, leaveGroup, i18n, id } =
      this.props;

    if (!hasLeaveGroupConfirmation) {
      return;
    }

    return (
      <ConfirmationDialog
        dialogName="ConversationHeader.leaveGroup"
        title={i18n('icu:ConversationHeader__LeaveGroupConfirmation__title')}
        actions={[
          {
            disabled: cannotLeaveBecauseYouAreLastAdmin,
            action: () => {
              this.setState({ hasLeaveGroupConfirmation: false });
              if (!cannotLeaveBecauseYouAreLastAdmin) {
                leaveGroup(id);
              } else {
                this.setState({
                  hasLeaveGroupConfirmation: false,
                  hasCannotLeaveGroupBecauseYouAreLastAdminAlert: true,
                });
              }
            },
            style: 'negative',
            text: i18n(
              'icu:ConversationHeader__LeaveGroupConfirmation__confirmButton'
            ),
          },
        ]}
        i18n={i18n}
        onClose={() => {
          this.setState({ hasLeaveGroupConfirmation: false });
        }}
      >
        {i18n('icu:ConversationHeader__LeaveGroupConfirmation__description')}
      </ConfirmationDialog>
    );
  }

  private renderCannotLeaveGroupBecauseYouAreLastAdminAlert() {
    const { hasCannotLeaveGroupBecauseYouAreLastAdminAlert } = this.state;
    const { i18n } = this.props;

    if (!hasCannotLeaveGroupBecauseYouAreLastAdminAlert) {
      return;
    }

    return (
      <Alert
        i18n={i18n}
        body={i18n(
          'icu:ConversationHeader__CannotLeaveGroupBecauseYouAreLastAdminAlert__description'
        )}
        onClose={() => {
          this.setState({
            hasCannotLeaveGroupBecauseYouAreLastAdminAlert: false,
          });
        }}
      />
    );
  }

  private renderHeader(): ReactNode {
    const { groupVersion, pushPanelForConversation, type } = this.props;

    let onClick: undefined | (() => void);
    switch (type) {
      case 'direct':
        onClick = () => {
          pushPanelForConversation({ type: PanelType.ConversationDetails });
        };
        break;
      case 'group': {
        const hasGV2AdminEnabled = groupVersion === 2;
        onClick = hasGV2AdminEnabled
          ? () => {
              pushPanelForConversation({
                type: PanelType.ConversationDetails,
              });
            }
          : undefined;
        break;
      }
      default:
        throw missingCaseError(type);
    }

    const avatar = this.renderAvatar(onClick);
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
          <div>
            <button
              type="button"
              className="module-ConversationHeader__header--clickable"
              onClick={onClick}
            >
              {contents}
            </button>
          </div>
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
      hasPanelShowing,
      i18n,
      id,
      isSMSOnly,
      isSignalConversation,
      onOutgoingAudioCallInConversation,
      onOutgoingVideoCallInConversation,
      outgoingCallButtonStyle,
      setDisappearingMessages,
    } = this.props;

    if (hasPanelShowing) {
      return null;
    }

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
        {this.renderDeleteMessagesConfirmationDialog()}
        {this.renderLeaveGroupConfirmationDialog()}
        {this.renderCannotLeaveGroupBecauseYouAreLastAdminAlert()}
        <SizeObserver
          onSizeChange={size => {
            this.setState({ isNarrow: size.width < 500 });
          }}
        >
          {measureRef => (
            <div
              className={classNames('module-ConversationHeader', {
                'module-ConversationHeader--narrow': isNarrow,
              })}
              ref={measureRef}
            >
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
                />
              )}
              {this.renderSearchButton()}
              {this.renderMoreButton(triggerId)}
              {this.renderMenu(triggerId)}
            </div>
          )}
        </SizeObserver>
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
}: { isNarrow: boolean } & Pick<
  PropsType,
  | 'announcementsOnly'
  | 'areWeAdmin'
  | 'i18n'
  | 'id'
  | 'onOutgoingAudioCallInConversation'
  | 'onOutgoingVideoCallInConversation'
  | 'outgoingCallButtonStyle'
>): JSX.Element | null {
  const videoButton = (
    <button
      aria-label={i18n('icu:makeOutgoingVideoCall')}
      className={classNames(
        'module-ConversationHeader__button',
        'module-ConversationHeader__button--video',
        announcementsOnly && !areWeAdmin
          ? 'module-ConversationHeader__button--show-disabled'
          : undefined
      )}
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
              'module-ConversationHeader__button--audio'
            )}
            aria-label={i18n('icu:makeOutgoingCall')}
          />
        </>
      );
    case OutgoingCallButtonStyle.Join:
      return (
        <button
          aria-label={i18n('icu:joinOngoingCall')}
          className={classNames(
            'module-ConversationHeader__button',
            'module-ConversationHeader__button--join-call',
            announcementsOnly && !areWeAdmin
              ? 'module-ConversationHeader__button--show-disabled'
              : undefined
          )}
          onClick={() => onOutgoingVideoCallInConversation(id)}
          type="button"
        >
          {isNarrow ? null : i18n('icu:joinOngoingCall')}
        </button>
      );
    default:
      throw missingCaseError(outgoingCallButtonStyle);
  }
}
