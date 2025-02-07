// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import type { ReactNode, RefObject } from 'react';
import React, { memo, useRef, useState } from 'react';
import {
  ContextMenu,
  ContextMenuTrigger,
  MenuItem,
  SubMenu,
} from 'react-contextmenu';
import { createPortal } from 'react-dom';
import type { BadgeType } from '../../badges/types';
import {
  useKeyboardShortcuts,
  useStartCallShortcuts,
} from '../../hooks/useKeyboardShortcuts';
import { SizeObserver } from '../../hooks/useSizeObserver';
import type { ConversationTypeType } from '../../state/ducks/conversations';
import type { HasStories } from '../../types/Stories';
import type { LocalizerType, ThemeType } from '../../types/Util';
import { DurationInSeconds } from '../../util/durations';
import * as expirationTimer from '../../util/expirationTimer';
import { getMuteOptions } from '../../util/getMuteOptions';
import { isConversationMuted } from '../../util/isConversationMuted';
import { isInSystemContacts } from '../../util/isInSystemContacts';
import { missingCaseError } from '../../util/missingCaseError';
import { Alert } from '../Alert';
import { Avatar, AvatarSize } from '../Avatar';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { DisappearingTimeDialog } from '../DisappearingTimeDialog';
import { InContactsIcon } from '../InContactsIcon';
import { UserText } from '../UserText';
import type { ContactNameData } from './ContactName';
import {
  MessageRequestActionsConfirmation,
  MessageRequestState,
} from './MessageRequestActionsConfirmation';
import type { MinimalConversation } from '../../hooks/useMinimalConversation';
import { LocalDeleteWarningModal } from '../LocalDeleteWarningModal';
import { InAnotherCallTooltip } from './InAnotherCallTooltip';

function HeaderInfoTitle({
  name,
  title,
  type,
  i18n,
  isMe,
  isSignalConversation,
  headerRef,
}: {
  name: string | null;
  title: string;
  type: ConversationTypeType;
  i18n: LocalizerType;
  isMe: boolean;
  isSignalConversation: boolean;
  headerRef: React.RefObject<HTMLDivElement>;
}) {
  if (isSignalConversation) {
    return (
      <div className="module-ConversationHeader__header__info__title">
        <UserText text={title} />
        <span className="ContactModal__official-badge" />
      </div>
    );
  }

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
      {isInSystemContacts({ name: name ?? undefined, type }) ? (
        <InContactsIcon
          className="module-ConversationHeader__header__info__title__in-contacts-icon"
          i18n={i18n}
          tooltipContainerRef={headerRef}
        />
      ) : null}
    </div>
  );
}

export enum OutgoingCallButtonStyle {
  None,
  JustVideo,
  Both,
  Join,
}

export type PropsDataType = {
  addedByName: ContactNameData | null;
  badge?: BadgeType;
  cannotLeaveBecauseYouAreLastAdmin: boolean;
  conversation: MinimalConversation;
  conversationName: ContactNameData;
  hasPanelShowing?: boolean;
  hasStories?: HasStories;
  hasActiveCall?: boolean;
  localDeleteWarningShown: boolean;
  isDeleteSyncSendEnabled: boolean;
  isMissingMandatoryProfileSharing?: boolean;
  isSelectMode: boolean;
  isSignalConversation?: boolean;
  isSmsOnlyOrUnregistered?: boolean;
  outgoingCallButtonStyle: OutgoingCallButtonStyle;
  sharedGroupNames: ReadonlyArray<string>;
  theme: ThemeType;
};

export type PropsActionsType = {
  setLocalDeleteWarningShown: () => void;

  onConversationAccept: () => void;
  onConversationArchive: () => void;
  onConversationBlock: () => void;
  onConversationBlockAndReportSpam: () => void;
  onConversationDelete: () => void;
  onConversationDeleteMessages: () => void;
  onConversationDisappearingMessagesChange: (
    seconds: DurationInSeconds
  ) => void;
  onConversationLeaveGroup: () => void;
  onConversationMarkUnread: () => void;
  onConversationMuteExpirationChange: (seconds: number) => void;
  onConversationPin: () => void;
  onConversationUnpin: () => void;
  onConversationReportSpam: () => void;
  onConversationUnarchive: () => void;
  onOutgoingAudioCall: () => void;
  onOutgoingVideoCall: () => void;
  onSearchInConversation: () => void;
  onSelectModeEnter: () => void;
  onShowMembers: () => void;
  onViewAllMedia: () => void;
  onViewConversationDetails: () => void;
  onViewUserStories: () => void;
};

export type PropsHousekeepingType = {
  i18n: LocalizerType;
};

export type PropsType = PropsDataType &
  PropsActionsType &
  PropsHousekeepingType;

const TIMER_ITEM_CLASS = 'module-ConversationHeader__disappearing-timer__item';

export const ConversationHeader = memo(function ConversationHeader({
  addedByName,
  badge,
  cannotLeaveBecauseYouAreLastAdmin,
  conversation,
  conversationName,
  hasActiveCall,
  hasPanelShowing,
  hasStories,
  i18n,
  isDeleteSyncSendEnabled,
  isMissingMandatoryProfileSharing,
  isSelectMode,
  isSignalConversation,
  isSmsOnlyOrUnregistered,
  localDeleteWarningShown,
  onConversationAccept,
  onConversationArchive,
  onConversationBlock,
  onConversationBlockAndReportSpam,
  onConversationDelete,
  onConversationDeleteMessages,
  onConversationDisappearingMessagesChange,
  onConversationLeaveGroup,
  onConversationMarkUnread,
  onConversationMuteExpirationChange,
  onConversationPin,
  onConversationReportSpam,
  onConversationUnarchive,
  onConversationUnpin,
  onOutgoingAudioCall,
  onOutgoingVideoCall,
  onSearchInConversation,
  onSelectModeEnter,
  onShowMembers,
  onViewAllMedia,
  onViewConversationDetails,
  onViewUserStories,
  outgoingCallButtonStyle,
  setLocalDeleteWarningShown,
  sharedGroupNames,
  theme,
}: PropsType): JSX.Element | null {
  // Comes from a third-party dependency
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const menuTriggerRef = useRef<any>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const [
    hasCustomDisappearingTimeoutModal,
    setHasCustomDisappearingTimeoutModal,
  ] = useState(false);
  const [hasDeleteMessagesConfirmation, setHasDeleteMessagesConfirmation] =
    useState(false);
  const [hasLeaveGroupConfirmation, setHasLeaveGroupConfirmation] =
    useState(false);
  const [
    hasCannotLeaveGroupBecauseYouAreLastAdminAlert,
    setHasCannotLeaveGroupBecauseYouAreLastAdminAlert,
  ] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [messageRequestState, setMessageRequestState] = useState(
    MessageRequestState.default
  );

  const triggerId = `conversation-${conversation.id}`;

  if (hasPanelShowing) {
    return null;
  }

  return (
    <>
      {hasCustomDisappearingTimeoutModal && (
        <DisappearingTimeDialog
          i18n={i18n}
          initialValue={conversation.expireTimer}
          onSubmit={value => {
            setHasCustomDisappearingTimeoutModal(false);
            onConversationDisappearingMessagesChange(value);
          }}
          onClose={() => {
            setHasCustomDisappearingTimeoutModal(false);
          }}
        />
      )}
      {hasDeleteMessagesConfirmation && (
        <DeleteMessagesConfirmationDialog
          i18n={i18n}
          isDeleteSyncSendEnabled={isDeleteSyncSendEnabled}
          localDeleteWarningShown={localDeleteWarningShown}
          onDestroyMessages={() => {
            setHasDeleteMessagesConfirmation(false);
            onConversationDeleteMessages();
          }}
          onClose={() => {
            setHasDeleteMessagesConfirmation(false);
          }}
          setLocalDeleteWarningShown={setLocalDeleteWarningShown}
        />
      )}
      {hasLeaveGroupConfirmation && (
        <LeaveGroupConfirmationDialog
          i18n={i18n}
          cannotLeaveBecauseYouAreLastAdmin={cannotLeaveBecauseYouAreLastAdmin}
          onClose={() => {
            setHasLeaveGroupConfirmation(false);
          }}
          onLeaveGroup={() => {
            setHasLeaveGroupConfirmation(false);
            if (!cannotLeaveBecauseYouAreLastAdmin) {
              onConversationLeaveGroup();
            } else {
              setHasLeaveGroupConfirmation(false);
              setHasCannotLeaveGroupBecauseYouAreLastAdminAlert(true);
            }
          }}
        />
      )}
      {hasCannotLeaveGroupBecauseYouAreLastAdminAlert && (
        <CannotLeaveGroupBecauseYouAreLastAdminAlert
          i18n={i18n}
          onClose={() => {
            setHasCannotLeaveGroupBecauseYouAreLastAdminAlert(false);
          }}
        />
      )}
      <SizeObserver
        onSizeChange={size => {
          setIsNarrow(size.width < 500);
        }}
      >
        {measureRef => (
          <div
            className={classNames('module-ConversationHeader', {
              'module-ConversationHeader--narrow': isNarrow,
            })}
            ref={measureRef}
          >
            <HeaderContent
              conversation={conversation}
              badge={badge ?? null}
              hasStories={hasStories ?? null}
              headerRef={headerRef}
              i18n={i18n}
              sharedGroupNames={sharedGroupNames}
              theme={theme}
              onViewUserStories={onViewUserStories}
              onViewConversationDetails={onViewConversationDetails}
              isSignalConversation={isSignalConversation ?? false}
            />
            {!isSmsOnlyOrUnregistered && !isSignalConversation && (
              <OutgoingCallButtons
                conversation={conversation}
                hasActiveCall={hasActiveCall}
                i18n={i18n}
                isNarrow={isNarrow}
                onOutgoingAudioCall={onOutgoingAudioCall}
                onOutgoingVideoCall={onOutgoingVideoCall}
                outgoingCallButtonStyle={outgoingCallButtonStyle}
              />
            )}
            <button
              type="button"
              onClick={onSearchInConversation}
              className={classNames(
                'module-ConversationHeader__button',
                'module-ConversationHeader__button--search'
              )}
              aria-label={i18n('icu:search')}
            />
            <ContextMenuTrigger
              id={triggerId}
              ref={menuTriggerRef}
              disable={isSelectMode}
            >
              <button
                type="button"
                onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
                  menuTriggerRef.current?.handleContextClick(event);
                }}
                className={classNames(
                  'module-ConversationHeader__button',
                  'module-ConversationHeader__button--more'
                )}
                aria-label={i18n('icu:moreInfo')}
                disabled={isSelectMode}
              />
            </ContextMenuTrigger>
            <HeaderMenu
              i18n={i18n}
              conversation={conversation}
              isMissingMandatoryProfileSharing={
                isMissingMandatoryProfileSharing ?? false
              }
              isSelectMode={isSelectMode}
              isSignalConversation={isSignalConversation ?? false}
              onChangeDisappearingMessages={
                onConversationDisappearingMessagesChange
              }
              onChangeMuteExpiration={onConversationMuteExpirationChange}
              onConversationAccept={onConversationAccept}
              onConversationArchive={onConversationArchive}
              onConversationBlock={() => {
                setMessageRequestState(MessageRequestState.blocking);
              }}
              onConversationDelete={() => {
                setMessageRequestState(MessageRequestState.deleting);
              }}
              onConversationDeleteMessages={() => {
                setHasDeleteMessagesConfirmation(true);
              }}
              onConversationLeaveGroup={() => {
                if (cannotLeaveBecauseYouAreLastAdmin) {
                  setHasCannotLeaveGroupBecauseYouAreLastAdminAlert(true);
                } else {
                  setHasLeaveGroupConfirmation(true);
                }
              }}
              onConversationMarkUnread={onConversationMarkUnread}
              onConversationPin={onConversationPin}
              onConversationReportAndMaybeBlock={() => {
                setMessageRequestState(
                  MessageRequestState.reportingAndMaybeBlocking
                );
              }}
              onConversationUnarchive={onConversationUnarchive}
              onConversationUnblock={() => {
                setMessageRequestState(MessageRequestState.unblocking);
              }}
              onConversationUnpin={onConversationUnpin}
              onSelectModeEnter={onSelectModeEnter}
              onSetupCustomDisappearingTimeout={() => {
                setHasCustomDisappearingTimeoutModal(true);
              }}
              onShowMembers={onShowMembers}
              onViewAllMedia={onViewAllMedia}
              onViewConversationDetails={onViewConversationDetails}
              triggerId={triggerId}
            />
            <MessageRequestActionsConfirmation
              i18n={i18n}
              conversationId={conversation.id}
              conversationType={conversation.type}
              addedByName={addedByName}
              conversationName={conversationName}
              isBlocked={conversation.isBlocked ?? false}
              isReported={conversation.isReported ?? false}
              state={messageRequestState}
              acceptConversation={onConversationAccept}
              blockAndReportSpam={onConversationBlockAndReportSpam}
              blockConversation={onConversationBlock}
              reportSpam={onConversationReportSpam}
              deleteConversation={onConversationDelete}
              onChangeState={setMessageRequestState}
            />
          </div>
        )}
      </SizeObserver>
    </>
  );
});

function HeaderContent({
  conversation,
  badge,
  hasStories,
  headerRef,
  i18n,
  sharedGroupNames,
  theme,
  isSignalConversation,
  onViewUserStories,
  onViewConversationDetails,
}: {
  conversation: MinimalConversation;
  badge: BadgeType | null;
  hasStories: HasStories | null;
  headerRef: RefObject<HTMLDivElement>;
  i18n: LocalizerType;
  sharedGroupNames: ReadonlyArray<string>;
  theme: ThemeType;
  isSignalConversation: boolean;
  onViewUserStories: () => void;
  onViewConversationDetails: () => void;
}) {
  let onClick: undefined | (() => void);
  const { type } = conversation;
  switch (type) {
    case 'direct':
      onClick = onViewConversationDetails;
      break;
    case 'group': {
      const hasGV2AdminEnabled = conversation.groupVersion === 2;
      onClick = hasGV2AdminEnabled ? onViewConversationDetails : undefined;
      break;
    }
    default:
      throw missingCaseError(type);
  }

  const avatar = (
    <span className="module-ConversationHeader__header__avatar">
      <Avatar
        acceptedMessageRequest={conversation.acceptedMessageRequest}
        avatarUrl={conversation.avatarUrl ?? undefined}
        badge={badge ?? undefined}
        color={conversation.color ?? undefined}
        conversationType={conversation.type}
        i18n={i18n}
        isMe={conversation.isMe}
        noteToSelf={conversation.isMe}
        onClick={hasStories ? onViewUserStories : onClick}
        phoneNumber={conversation.phoneNumber ?? undefined}
        profileName={conversation.profileName ?? undefined}
        sharedGroupNames={sharedGroupNames}
        size={AvatarSize.THIRTY_TWO}
        // user may have stories, but we don't show that on Note to Self conversation
        storyRing={conversation.isMe ? undefined : (hasStories ?? undefined)}
        theme={theme}
        title={conversation.title}
        unblurredAvatarUrl={conversation.unblurredAvatarUrl ?? undefined}
      />
    </span>
  );

  const contents = (
    <div className="module-ConversationHeader__header__info">
      <HeaderInfoTitle
        name={conversation.name ?? null}
        title={conversation.title}
        type={conversation.type}
        i18n={i18n}
        isMe={conversation.isMe}
        isSignalConversation={isSignalConversation}
        headerRef={headerRef}
      />
      {(conversation.expireTimer != null || conversation.isVerified) && (
        <div className="module-ConversationHeader__header__info__subtitle">
          {conversation.expireTimer != null &&
            conversation.expireTimer !== 0 && (
              <div className="module-ConversationHeader__header__info__subtitle__expiration">
                {expirationTimer.format(i18n, conversation.expireTimer)}
              </div>
            )}
          {conversation.isVerified && (
            <div className="module-ConversationHeader__header__info__subtitle__verified">
              {i18n('icu:verified')}
            </div>
          )}
        </div>
      )}
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
    <div className="module-ConversationHeader__header" ref={headerRef}>
      {avatar}
      {contents}
    </div>
  );
}

function HeaderMenu({
  conversation,
  i18n,
  isMissingMandatoryProfileSharing,
  isSelectMode,
  isSignalConversation,
  onChangeDisappearingMessages,
  onChangeMuteExpiration,
  onConversationAccept,
  onConversationArchive,
  onConversationBlock,
  onConversationDelete,
  onConversationDeleteMessages,
  onConversationLeaveGroup,
  onConversationMarkUnread,
  onConversationPin,
  onConversationReportAndMaybeBlock,
  onConversationUnarchive,
  onConversationUnblock,
  onConversationUnpin,
  onSelectModeEnter,
  onSetupCustomDisappearingTimeout,
  onShowMembers,
  onViewAllMedia,
  onViewConversationDetails,
  triggerId,
}: {
  conversation: MinimalConversation;
  i18n: LocalizerType;
  isMissingMandatoryProfileSharing: boolean;
  isSelectMode: boolean;
  isSignalConversation: boolean;
  onChangeDisappearingMessages: (seconds: DurationInSeconds) => void;
  onChangeMuteExpiration: (seconds: number) => void;
  onConversationAccept: () => void;
  onConversationArchive: () => void;
  onConversationBlock: () => void;
  onConversationDelete: () => void;
  onConversationDeleteMessages: () => void;
  onConversationLeaveGroup: () => void;
  onConversationMarkUnread: () => void;
  onConversationPin: () => void;
  onConversationReportAndMaybeBlock: () => void;
  onConversationUnarchive: () => void;
  onConversationUnblock: () => void;
  onConversationUnpin: () => void;
  onSelectModeEnter: () => void;
  onSetupCustomDisappearingTimeout: () => void;
  onShowMembers: () => void;
  onViewAllMedia: () => void;
  onViewConversationDetails: () => void;
  triggerId: string;
}) {
  const isRTL = i18n.getLocaleDirection() === 'rtl';
  const muteOptions = getMuteOptions(conversation.muteExpiresAt, i18n);
  const isGroup = conversation.type === 'group';
  const disableTimerChanges = Boolean(
    !conversation.canChangeTimer ||
      !conversation.acceptedMessageRequest ||
      conversation.left ||
      isMissingMandatoryProfileSharing
  );
  const hasGV2AdminEnabled = isGroup && conversation.groupVersion === 2;

  const isActiveExpireTimer = (value: number): boolean => {
    if (!conversation.expireTimer) {
      return value === 0;
    }

    // Custom time...
    if (value === -1) {
      return !expirationTimer.DEFAULT_DURATIONS_SET.has(
        conversation.expireTimer
      );
    }
    return value === conversation.expireTimer;
  };

  if (isSelectMode) {
    return null;
  }

  const muteTitle = <span>{i18n('icu:muteNotificationsTitle')}</span>;
  const disappearingTitle = <span>{i18n('icu:disappearingMessages')}</span>;

  if (isSignalConversation) {
    const isMuted =
      conversation.muteExpiresAt && isConversationMuted(conversation);

    return (
      <ContextMenu id={triggerId} rtl={isRTL}>
        <SubMenu hoverDelay={1} title={muteTitle} rtl={!isRTL}>
          {isMuted ? (
            <MenuItem
              onClick={() => {
                onChangeMuteExpiration(0);
              }}
            >
              {i18n('icu:unmute')}
            </MenuItem>
          ) : (
            <MenuItem
              onClick={() => {
                onChangeMuteExpiration(Number.MAX_SAFE_INTEGER);
              }}
            >
              {i18n('icu:muteAlways')}
            </MenuItem>
          )}
        </SubMenu>
        {conversation.isArchived ? (
          <MenuItem onClick={onConversationUnarchive}>
            {i18n('icu:moveConversationToInbox')}
          </MenuItem>
        ) : (
          <MenuItem onClick={onConversationArchive}>
            {i18n('icu:archiveConversation')}
          </MenuItem>
        )}

        <MenuItem onClick={onConversationDeleteMessages}>
          {i18n('icu:deleteConversation')}
        </MenuItem>
      </ContextMenu>
    );
  }

  if (isGroup && conversation.groupVersion !== 2) {
    return (
      <ContextMenu id={triggerId}>
        <MenuItem onClick={onShowMembers}>{i18n('icu:showMembers')}</MenuItem>
        <MenuItem onClick={onViewAllMedia}>
          {i18n('icu:allMediaMenuItem')}
        </MenuItem>
        <MenuItem divider />
        {conversation.isArchived ? (
          <MenuItem onClick={onConversationUnarchive}>
            {i18n('icu:moveConversationToInbox')}
          </MenuItem>
        ) : (
          <MenuItem onClick={onConversationArchive}>
            {i18n('icu:archiveConversation')}
          </MenuItem>
        )}

        <MenuItem onClick={onConversationDeleteMessages}>
          {i18n('icu:deleteConversation')}
        </MenuItem>
      </ContextMenu>
    );
  }

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
        onSetupCustomDisappearingTimeout();
      } else {
        onChangeDisappearingMessages(seconds);
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
      {!conversation.acceptedMessageRequest && (
        <>
          {!conversation.isBlocked && (
            <MenuItem onClick={onConversationBlock}>
              {i18n('icu:ConversationHeader__MenuItem--Block')}
            </MenuItem>
          )}
          {conversation.isBlocked && (
            <MenuItem onClick={onConversationUnblock}>
              {i18n('icu:ConversationHeader__MenuItem--Unblock')}
            </MenuItem>
          )}
          {!conversation.isBlocked && (
            <MenuItem onClick={onConversationAccept}>
              {i18n('icu:ConversationHeader__MenuItem--Accept')}
            </MenuItem>
          )}
          <MenuItem onClick={onConversationReportAndMaybeBlock}>
            {i18n('icu:ConversationHeader__MenuItem--ReportSpam')}
          </MenuItem>
          <MenuItem onClick={onConversationDelete}>
            {i18n('icu:ConversationHeader__MenuItem--DeleteChat')}
          </MenuItem>
        </>
      )}
      {conversation.acceptedMessageRequest && (
        <>
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
                  onChangeMuteExpiration(item.value);
                }}
              >
                {item.name}
              </MenuItem>
            ))}
          </SubMenu>
          {!isGroup || hasGV2AdminEnabled ? (
            <MenuItem onClick={onViewConversationDetails}>
              {isGroup
                ? i18n('icu:showConversationDetails')
                : i18n('icu:showConversationDetails--direct')}
            </MenuItem>
          ) : null}
          <MenuItem onClick={onViewAllMedia}>
            {i18n('icu:allMediaMenuItem')}
          </MenuItem>
          <MenuItem divider />
          <MenuItem onClick={onSelectModeEnter}>
            {i18n('icu:ConversationHeader__menu__selectMessages')}
          </MenuItem>
          <MenuItem divider />
          {!conversation.markedUnread ? (
            <MenuItem onClick={onConversationMarkUnread}>
              {i18n('icu:markUnread')}
            </MenuItem>
          ) : null}
          {conversation.isPinned ? (
            <MenuItem onClick={onConversationUnpin}>
              {i18n('icu:unpinConversation')}
            </MenuItem>
          ) : (
            <MenuItem onClick={onConversationPin}>
              {i18n('icu:pinConversation')}
            </MenuItem>
          )}
          {conversation.isArchived ? (
            <MenuItem onClick={onConversationUnarchive}>
              {i18n('icu:moveConversationToInbox')}
            </MenuItem>
          ) : (
            <MenuItem onClick={onConversationArchive}>
              {i18n('icu:archiveConversation')}
            </MenuItem>
          )}
          {!conversation.isBlocked && (
            <MenuItem onClick={onConversationBlock}>
              {i18n('icu:ConversationHeader__MenuItem--Block')}
            </MenuItem>
          )}
          {conversation.isBlocked && (
            <MenuItem onClick={onConversationUnblock}>
              {i18n('icu:ConversationHeader__MenuItem--Unblock')}
            </MenuItem>
          )}
          <MenuItem onClick={onConversationDeleteMessages}>
            {i18n('icu:deleteConversation')}
          </MenuItem>
          {isGroup && (
            <MenuItem onClick={onConversationLeaveGroup}>
              {i18n(
                'icu:ConversationHeader__ContextMenu__LeaveGroupAction__title'
              )}
            </MenuItem>
          )}
        </>
      )}
    </ContextMenu>,
    document.body
  );
}

function OutgoingCallButtons({
  conversation,
  hasActiveCall,
  i18n,
  isNarrow,
  onOutgoingAudioCall,
  onOutgoingVideoCall,
  outgoingCallButtonStyle,
}: { isNarrow: boolean } & Pick<
  PropsType,
  | 'i18n'
  | 'conversation'
  | 'hasActiveCall'
  | 'onOutgoingAudioCall'
  | 'onOutgoingVideoCall'
  | 'outgoingCallButtonStyle'
>): JSX.Element | null {
  const disabled =
    conversation.type === 'group' &&
    conversation.announcementsOnly &&
    !conversation.areWeAdmin;
  const inAnotherCall = !disabled && hasActiveCall;

  const videoButton = (
    <button
      aria-label={i18n('icu:makeOutgoingVideoCall')}
      className={classNames(
        'module-ConversationHeader__button',
        'module-ConversationHeader__button--video',
        disabled
          ? 'module-ConversationHeader__button--show-disabled'
          : undefined,
        inAnotherCall
          ? 'module-ConversationHeader__button--in-another-call'
          : undefined
      )}
      onClick={onOutgoingVideoCall}
      type="button"
    />
  );
  const videoElement = inAnotherCall ? (
    <InAnotherCallTooltip i18n={i18n}>{videoButton}</InAnotherCallTooltip>
  ) : (
    videoButton
  );

  const startCallShortcuts = useStartCallShortcuts(
    onOutgoingAudioCall,
    onOutgoingVideoCall
  );
  useKeyboardShortcuts(startCallShortcuts);

  switch (outgoingCallButtonStyle) {
    case OutgoingCallButtonStyle.None:
      return null;
    case OutgoingCallButtonStyle.JustVideo:
      return videoElement;
    case OutgoingCallButtonStyle.Both:
      // eslint-disable-next-line no-case-declarations
      const audioButton = (
        <button
          type="button"
          onClick={onOutgoingAudioCall}
          className={classNames(
            'module-ConversationHeader__button',
            'module-ConversationHeader__button--audio',
            inAnotherCall
              ? 'module-ConversationHeader__button--in-another-call'
              : undefined
          )}
          aria-label={i18n('icu:makeOutgoingCall')}
        />
      );

      return (
        <>
          {videoElement}
          {inAnotherCall ? (
            <InAnotherCallTooltip i18n={i18n}>
              {audioButton}
            </InAnotherCallTooltip>
          ) : (
            audioButton
          )}
        </>
      );
    case OutgoingCallButtonStyle.Join:
      // eslint-disable-next-line no-case-declarations
      const joinButton = (
        <button
          aria-label={i18n('icu:joinOngoingCall')}
          className={classNames(
            'module-ConversationHeader__button',
            'module-ConversationHeader__button--join-call',
            disabled
              ? 'module-ConversationHeader__button--show-disabled'
              : undefined,
            inAnotherCall
              ? 'module-ConversationHeader__button--in-another-call'
              : undefined
          )}
          onClick={onOutgoingVideoCall}
          type="button"
        >
          {isNarrow ? null : i18n('icu:joinOngoingCall')}
        </button>
      );
      return inAnotherCall ? (
        <InAnotherCallTooltip i18n={i18n}>{joinButton}</InAnotherCallTooltip>
      ) : (
        joinButton
      );
    default:
      throw missingCaseError(outgoingCallButtonStyle);
  }
}

function LeaveGroupConfirmationDialog({
  cannotLeaveBecauseYouAreLastAdmin,
  i18n,
  onLeaveGroup,
  onClose,
}: {
  cannotLeaveBecauseYouAreLastAdmin: boolean;
  i18n: LocalizerType;
  onLeaveGroup: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmationDialog
      dialogName="ConversationHeader.leaveGroup"
      title={i18n('icu:ConversationHeader__LeaveGroupConfirmation__title')}
      actions={[
        {
          disabled: cannotLeaveBecauseYouAreLastAdmin,
          action: onLeaveGroup,
          style: 'negative',
          text: i18n(
            'icu:ConversationHeader__LeaveGroupConfirmation__confirmButton'
          ),
        },
      ]}
      i18n={i18n}
      onClose={onClose}
    >
      {i18n('icu:ConversationHeader__LeaveGroupConfirmation__description')}
    </ConfirmationDialog>
  );
}

function CannotLeaveGroupBecauseYouAreLastAdminAlert({
  i18n,
  onClose,
}: {
  i18n: LocalizerType;
  onClose: () => void;
}) {
  return (
    <Alert
      i18n={i18n}
      body={i18n(
        'icu:ConversationHeader__CannotLeaveGroupBecauseYouAreLastAdminAlert__description'
      )}
      onClose={onClose}
    />
  );
}

function DeleteMessagesConfirmationDialog({
  isDeleteSyncSendEnabled,
  i18n,
  localDeleteWarningShown,
  onDestroyMessages,
  onClose,
  setLocalDeleteWarningShown,
}: {
  isDeleteSyncSendEnabled: boolean;
  i18n: LocalizerType;
  localDeleteWarningShown: boolean;
  onDestroyMessages: () => void;
  onClose: () => void;
  setLocalDeleteWarningShown: () => void;
}) {
  if (!localDeleteWarningShown && isDeleteSyncSendEnabled) {
    return (
      <LocalDeleteWarningModal
        i18n={i18n}
        onClose={setLocalDeleteWarningShown}
      />
    );
  }

  const dialogBody = isDeleteSyncSendEnabled
    ? i18n(
        'icu:ConversationHeader__DeleteConversationConfirmation__description-with-sync'
      )
    : i18n(
        'icu:ConversationHeader__DeleteConversationConfirmation__description'
      );

  return (
    <ConfirmationDialog
      dialogName="ConversationHeader.destroyMessages"
      title={i18n(
        'icu:ConversationHeader__DeleteConversationConfirmation__title'
      )}
      actions={[
        {
          action: onDestroyMessages,
          style: 'negative',
          text: i18n('icu:delete'),
        },
      ]}
      i18n={i18n}
      onClose={onClose}
    >
      {dialogBody}
    </ConfirmationDialog>
  );
}
