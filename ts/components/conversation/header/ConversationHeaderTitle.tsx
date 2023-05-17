import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useConversationUsername } from '../../../hooks/useParamSelector';
import { ConversationNotificationSettingType } from '../../../models/conversationAttributes';
import { closeRightPanel, openRightPanel } from '../../../state/ducks/conversations';
import { resetRightOverlayMode, setRightOverlayMode } from '../../../state/ducks/section';
import {
  getConversationHeaderTitleProps,
  getCurrentNotificationSettingText,
  isRightPanelShowing,
} from '../../../state/selectors/conversations';
import {
  DisappearingMessageConversationType,
  ExpirationTimerOptions,
} from '../../../util/expiringMessages';
import { ConversationHeaderSubitle } from './ConversationHeaderSubtitle';

export type SubtitleStrings = Record<string, string> & {
  notifications?: string;
  members?: string;
  disappearingMessages?: string;
};
export type SubtitleStringsType = keyof Pick<
  SubtitleStrings,
  'notifications' | 'members' | 'disappearingMessages'
>;

export type ConversationHeaderTitleProps = {
  conversationKey: string;
  isMe: boolean;
  isGroup: boolean;
  isPublic: boolean;
  members: Array<any>;
  subscriberCount?: number;
  isKickedFromGroup: boolean;
  currentNotificationSetting?: ConversationNotificationSettingType;
  expirationType?: DisappearingMessageConversationType;
  expireTimer?: number;
};

// tslint:disable: cyclomatic-complexity max-func-body-length
export const ConversationHeaderTitle = () => {
  const headerTitleProps = useSelector(getConversationHeaderTitleProps);
  const notificationSetting = useSelector(getCurrentNotificationSettingText);
  const isRightPanelOn = useSelector(isRightPanelShowing);

  const convoName = useConversationUsername(headerTitleProps?.conversationKey);
  const dispatch = useDispatch();

  const [visibleSubtitle, setVisibleSubtitle] = useState<SubtitleStringsType>('notifications');

  if (!headerTitleProps) {
    return null;
  }

  const {
    isGroup,
    isPublic,
    members,
    subscriberCount,
    isMe,
    isKickedFromGroup,
    expirationType,
    expireTimer,
  } = headerTitleProps;

  const { i18n } = window;

  const subtitleStrings: SubtitleStrings = {};
  const subtitleArray: Array<SubtitleStringsType> = [];

  const notificationSubtitle = notificationSetting
    ? i18n('notificationSubtitle', [notificationSetting])
    : null;
  if (notificationSubtitle) {
    subtitleStrings.notifications = notificationSubtitle;
    subtitleArray.push('notifications');
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
  const abbreviatedExpireTime = Boolean(expireTimer)
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

  useEffect(() => {
    setVisibleSubtitle('notifications');
  }, [convoName]);

  useEffect(() => {
    if (subtitleArray.indexOf(visibleSubtitle) < 0) {
      setVisibleSubtitle('notifications');
    }
  }, [subtitleArray, visibleSubtitle]);

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
          {subtitleArray.length && subtitleArray.indexOf(visibleSubtitle) > -1 && (
            <ConversationHeaderSubitle
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
