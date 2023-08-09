import { isNumber } from 'lodash';
import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useConversationUsername } from '../../../hooks/useParamSelector';
import { closeRightPanel, openRightPanel } from '../../../state/ducks/conversations';
import { resetRightOverlayMode, setRightOverlayMode } from '../../../state/ducks/section';
import { isRightPanelShowing } from '../../../state/selectors/conversations';
import {
  useSelectedConversationKey,
  useSelectedExpirationType,
  useSelectedExpireTimer,
  useSelectedIsGroup,
  useSelectedIsKickedFromGroup,
  useSelectedIsNoteToSelf,
  useSelectedIsPublic,
  useSelectedMembers,
  useSelectedNotificationSetting,
  useSelectedSubscriberCount,
} from '../../../state/selectors/selectedConversation';
import { ExpirationTimerOptions } from '../../../util/expiringMessages';
import { ConversationHeaderSubtitle } from './ConversationHeaderSubtitle';

export type SubtitleStrings = Record<string, string> & {
  notifications?: string;
  members?: string;
  disappearingMessages?: string;
};

export type SubtitleStringsType = keyof Pick<
  SubtitleStrings,
  'notifications' | 'members' | 'disappearingMessages'
>;

// tslint:disable: cyclomatic-complexity max-func-body-length
export const ConversationHeaderTitle = () => {
  const dispatch = useDispatch();
  const selectedConvoKey = useSelectedConversationKey();

  const notificationSetting = useSelectedNotificationSetting();
  const isRightPanelOn = useSelector(isRightPanelShowing);
  const subscriberCount = useSelectedSubscriberCount();

  const isPublic = useSelectedIsPublic();
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const isMe = useSelectedIsNoteToSelf();
  const isGroup = useSelectedIsGroup();
  const members = useSelectedMembers();

  const expireTimer = useSelectedExpireTimer();
  const expirationType = useSelectedExpirationType();
  const convoName = useConversationUsername(selectedConvoKey);

  const [visibleSubtitle, setVisibleSubtitle] = useState<SubtitleStringsType>('notifications');

  const subtitleStrings: SubtitleStrings = {};
  const subtitleArray: Array<SubtitleStringsType> = useMemo(() => {
    return [];
  }, []);

  const { i18n } = window;

  const notificationSubtitle = notificationSetting
    ? i18n('notificationSubtitle', [notificationSetting])
    : null;
  if (notificationSubtitle) {
    subtitleStrings.notifications = notificationSubtitle;
    subtitleArray.push('notifications');
  }

  useEffect(() => {
    setVisibleSubtitle('notifications');
  }, [convoName]);

  useEffect(() => {
    if (subtitleArray.indexOf(visibleSubtitle) < 0) {
      setVisibleSubtitle('notifications');
    }
  }, [subtitleArray, visibleSubtitle]);

  if (!selectedConvoKey) {
    return null;
  }

  let memberCount = 0;
  if (isGroup) {
    if (isPublic) {
      memberCount = subscriberCount || 0;
    } else {
      memberCount = members.length;
    }
  }

  let memberCountSubtitle = null;
  if (isGroup && memberCount > 0 && !isKickedFromGroup) {
    const count = String(memberCount);
    memberCountSubtitle = isPublic ? i18n('activeMembers', [count]) : i18n('members', [count]);
  }
  if (memberCountSubtitle) {
    subtitleStrings.members = memberCountSubtitle;
    subtitleArray.push('members');
  }

  const disappearingMessageSettingText =
    expirationType === 'off'
      ? null
      : expirationType === 'deleteAfterRead'
      ? window.i18n('disappearingMessagesModeAfterRead')
      : expirationType === 'deleteAfterSend'
      ? window.i18n('disappearingMessagesModeAfterSend')
      : // legacy mode support
      isMe || isGroup
      ? window.i18n('disappearingMessagesModeAfterSend')
      : window.i18n('disappearingMessagesModeAfterRead');
  const abbreviatedExpireTime = isNumber(expireTimer)
    ? ExpirationTimerOptions.getAbbreviated(expireTimer)
    : null;
  const disappearingMessageSubtitle = disappearingMessageSettingText
    ? `${disappearingMessageSettingText}${
        abbreviatedExpireTime ? ` - ${abbreviatedExpireTime}` : ''
      }`
    : null;
  if (disappearingMessageSubtitle) {
    subtitleStrings.disappearingMessages = disappearingMessageSubtitle;
    subtitleArray.push('disappearingMessages');
  }

  const handleRightPanelToggle = () => {
    if (isRightPanelOn) {
      dispatch(closeRightPanel());
    } else {
      if (visibleSubtitle === 'disappearingMessages') {
        dispatch(setRightOverlayMode('disappearing-messages'));
      } else {
        dispatch(resetRightOverlayMode());
      }
      dispatch(openRightPanel());
    }
  };

  return (
    <div className="module-conversation-header__title-container">
      <div className="module-conversation-header__title-flex">
        <div className="module-conversation-header__title">
          {isMe ? (
            <span
              onClick={handleRightPanelToggle}
              role="button"
              data-testid="header-conversation-name"
            >
              {i18n('noteToSelf')}
            </span>
          ) : (
            <span
              className="module-contact-name__profile-name"
              onClick={handleRightPanelToggle}
              role="button"
              data-testid="header-conversation-name"
            >
              {convoName}
            </span>
          )}
          {subtitleArray.indexOf(visibleSubtitle) > -1 && (
            <ConversationHeaderSubtitle
              currentSubtitle={visibleSubtitle}
              setCurrentSubtitle={setVisibleSubtitle}
              subtitlesArray={subtitleArray}
              subtitleStrings={subtitleStrings}
              onClickFunction={handleRightPanelToggle}
              showDisappearingMessageIcon={
                visibleSubtitle === 'disappearingMessages' && expirationType !== 'off'
              }
            />
          )}
        </div>
      </div>
    </div>
  );
};
