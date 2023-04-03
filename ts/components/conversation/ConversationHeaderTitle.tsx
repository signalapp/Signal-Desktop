import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled, { CSSProperties } from 'styled-components';
import { useConversationUsername } from '../../hooks/useParamSelector';
import { ConversationNotificationSettingType } from '../../models/conversationAttributes';
import { closeRightPanel, openRightPanel } from '../../state/ducks/conversations';
import { setRightOverlayMode } from '../../state/ducks/section';
import {
  getConversationHeaderTitleProps,
  getCurrentNotificationSettingText,
  isRightPanelShowing,
} from '../../state/selectors/conversations';
import {
  DisappearingMessageConversationType,
  ExpirationTimerOptions,
} from '../../util/expiringMessages';
import { Flex } from '../basic/Flex';
import { SessionIconButton } from '../icon';

export const StyledSubtitleContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  min-width: 230px;

  div:first-child {
    span:last-child {
      margin-bottom: 0;
    }
  }
`;

const StyledSubtitleDot = styled.span<{ active: boolean }>`
  border-radius: 50%;
  background-color: ${props =>
    props.active ? 'var(--text-primary-color)' : 'var(--text-secondary-color)'};

  height: 5px;
  width: 5px;
  margin: 0 2px;
`;

const SubtitleDotMenu = ({
  options,
  selectedOptionIndex,
  style,
}: {
  options: Array<string | null>;
  selectedOptionIndex: number;
  style: CSSProperties;
}) => (
  <Flex container={true} alignItems={'center'} style={style}>
    {options.map((option, index) => {
      if (!option) {
        return null;
      }

      return (
        <StyledSubtitleDot
          key={`subtitleDotMenu-${index}`}
          active={selectedOptionIndex === index}
        />
      );
    })}
  </Flex>
);

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

  let memberCount = 0;
  if (isGroup) {
    if (isPublic) {
      memberCount = subscriberCount || 0;
    } else {
      memberCount = members.length;
    }
  }
  if (notificationSubtitle) {
    subtitles.push(notificationSubtitle);
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
      : window.i18n('disappearingMessagesModeAfterSend');
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

  const handleTitleCycle = (direction: 1 | -1) => {
    let newIndex = visibleTitleIndex + direction;
    if (newIndex > subtitles.length - 1) {
      newIndex = 0;
    }

    if (newIndex < 0) {
      newIndex = subtitles.length - 1;
    }

    if (subtitles[newIndex]) {
      setVisibleTitleIndex(newIndex);
    }
  };

  useEffect(() => {
    setVisibleTitleIndex(0);
  }, [convoName]);

  if (isMe) {
    // TODO customise for new disappearing message system
    return <div className="module-conversation-header__title">{i18n('noteToSelf')}</div>;
  }

  return (
    <div className="module-conversation-header__title-container">
      <div className="module-conversation-header__title-flex">
        <div
          className="module-conversation-header__title"
          onClick={() => {
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
          }}
          role="button"
        >
          <span
            className="module-contact-name__profile-name"
            data-testid="header-conversation-name"
            style={{
              marginBottom:
                subtitles && subtitles[visibleTitleIndex] && subtitles.length > 1
                  ? '-5px'
                  : undefined,
            }}
          >
            {convoName}
          </span>
          {subtitles && subtitles[visibleTitleIndex] && (
            <StyledSubtitleContainer>
              <Flex
                container={true}
                flexDirection={'row'}
                justifyContent={subtitles.length < 2 ? 'center' : 'space-between'}
                alignItems={'center'}
                width={'100%'}
              >
                <SessionIconButton
                  iconColor={'var(--button-icon-stroke-selected-color)'}
                  iconSize={'medium'}
                  iconType="chevron"
                  iconRotation={90}
                  margin={'0 var(--margins-xs) 0 0'}
                  onClick={() => {
                    handleTitleCycle(-1);
                  }}
                  isHidden={subtitles.length < 2}
                />
                {visibleTitleIndex === 2 && expirationType !== 'off' && (
                  <SessionIconButton
                    iconColor={'var(--button-icon-stroke-selected-color)'}
                    iconSize={'tiny'}
                    iconType="timer50"
                    margin={'0 var(--margins-xs) 0 0'}
                  />
                )}
                <span className="module-conversation-header__title-text">
                  {subtitles[visibleTitleIndex]}
                </span>
                <SessionIconButton
                  iconColor={'var(--button-icon-stroke-selected-color)'}
                  iconSize={'medium'}
                  iconType="chevron"
                  iconRotation={270}
                  margin={'0 0 0 var(--margins-xs)'}
                  onClick={() => {
                    handleTitleCycle(1);
                  }}
                  isHidden={subtitles.length < 2}
                />
              </Flex>
              <SubtitleDotMenu
                options={subtitles}
                selectedOptionIndex={visibleTitleIndex}
                style={{ visibility: subtitles.length < 2 ? 'hidden' : undefined, margin: '3px 0' }}
              />
            </StyledSubtitleContainer>
          )}
        </div>
      </div>
    </div>
  );
};
