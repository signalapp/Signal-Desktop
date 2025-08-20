// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { createPortal } from 'react-dom';
import { ContextMenu, MenuItem, SubMenu } from 'react-contextmenu';
import classNames from 'classnames';

import type { LocalizerType } from '../../types/Util';
import type { MinimalConversation } from '../../hooks/useMinimalConversation';
import { DurationInSeconds } from '../../util/durations';
import { 
  DEFAULT_DURATIONS_SET, 
  DEFAULT_DURATIONS_IN_SECONDS, 
  format 
} from '../../util/expirationTimer';
import { isConversationMuted } from '../../util/isConversationMuted';
import { getMuteOptions } from '../../util/getMuteOptions';

const TIMER_ITEM_CLASS = 'module-conversation-list-context-menu__timer-item';

type PropsType = {
  conversation: MinimalConversation;
  i18n: LocalizerType;
  isMissingMandatoryProfileSharing: boolean;
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
};

export function ConversationListContextMenu({
  conversation,
  i18n,
  isMissingMandatoryProfileSharing,
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
}: PropsType): JSX.Element {
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
      return !DEFAULT_DURATIONS_SET.has(
        conversation.expireTimer
      );
    }
    return value === conversation.expireTimer;
  };

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

  const expireDurations: ReadonlyArray<React.ReactNode> = [
            ...DEFAULT_DURATIONS_IN_SECONDS,
    DurationInSeconds.fromSeconds(-1),
  ].map(seconds => {
    let text: string;

    if (seconds === -1) {
      text = i18n('icu:customDisappearingTimeOption');
    } else {
              text = format(i18n, seconds, {
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
