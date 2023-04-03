import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useConversationUsername } from '../../../hooks/useParamSelector';
import { ConversationNotificationSettingType } from '../../../models/conversationAttributes';
import { closeRightPanel, openRightPanel } from '../../../state/ducks/conversations';
import { setRightOverlayMode } from '../../../state/ducks/section';
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

  const [visibleTitleIndex, setVisibleTitleIndex] = useState(0);

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

  const subtitles: Array<string> = [];
  const notificationSubtitle = notificationSetting
    ? i18n('notificationSubtitle', [notificationSetting])
    : null;
  if (notificationSubtitle) {
    subtitles.push(notificationSubtitle);
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
    subtitles.push(memberCountSubtitle);
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
    subtitles.push(disappearingMessageSubtitle);
  }

  const handleRightPanelToggle = () => {
    if (isRightPanelOn) {
      dispatch(closeRightPanel());
    } else {
      if (visibleTitleIndex === 2) {
        dispatch(setRightOverlayMode('disappearing-messages'));
      } else {
        dispatch(setRightOverlayMode('panel-settings'));
      }
      dispatch(openRightPanel());
    }
  };

  useEffect(() => {
    setVisibleTitleIndex(0);
  }, [convoName]);

  useEffect(() => {
    if (!subtitles[visibleTitleIndex]) {
      setVisibleTitleIndex(0);
    }
  }, [visibleTitleIndex, subtitles]);

  return (
    <div className="module-conversation-header__title-container">
      <div className="module-conversation-header__title-flex">
        <div
          className="module-conversation-header__title"
          onClick={handleRightPanelToggle}
          role="button"
        >
          {isMe ? (
            <span>{i18n('noteToSelf')}</span>
          ) : (
            <span
              className="module-contact-name__profile-name"
              data-testid="header-conversation-name"
            >
              {convoName}
            </span>
          )}
          {subtitles && subtitles[visibleTitleIndex] && (
            <ConversationHeaderSubitle
              currentIndex={visibleTitleIndex}
              setCurrentIndex={setVisibleTitleIndex}
              subtitles={subtitles}
              onClickFunction={handleRightPanelToggle}
              showDisappearingMessageIcon={visibleTitleIndex === 2 && expirationType !== 'off'}
            />
          )}
        </div>
      </div>
    </div>
  );
};
