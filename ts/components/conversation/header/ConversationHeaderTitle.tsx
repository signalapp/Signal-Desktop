import { isEmpty } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useDisappearingMessageSettingText } from '../../../hooks/useParamSelector';
import { useIsRightPanelShowing } from '../../../hooks/useUI';
import { closeRightPanel, openRightPanel } from '../../../state/ducks/conversations';
import { resetRightOverlayMode, setRightOverlayMode } from '../../../state/ducks/section';
import {
  useSelectedConversationDisappearingMode,
  useSelectedConversationKey,
  useSelectedIsGroupOrCommunity,
  useSelectedIsKickedFromGroup,
  useSelectedIsNoteToSelf,
  useSelectedIsPublic,
  useSelectedMembers,
  useSelectedNicknameOrProfileNameOrShortenedPubkey,
  useSelectedNotificationSetting,
  useSelectedSubscriberCount,
} from '../../../state/selectors/selectedConversation';
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

export const ConversationHeaderTitle = () => {
  const dispatch = useDispatch();
  const convoId = useSelectedConversationKey();
  const convoName = useSelectedNicknameOrProfileNameOrShortenedPubkey();

  const notificationSetting = useSelectedNotificationSetting();
  const isRightPanelOn = useIsRightPanelShowing();
  const subscriberCount = useSelectedSubscriberCount();

  const isPublic = useSelectedIsPublic();
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const isMe = useSelectedIsNoteToSelf();
  const isGroup = useSelectedIsGroupOrCommunity();
  const members = useSelectedMembers();

  const expirationMode = useSelectedConversationDisappearingMode();
  const disappearingMessageSubtitle = useDisappearingMessageSettingText({
    convoId,
    abbreviate: true,
  });

  const [visibleSubtitle, setVisibleSubtitle] =
    useState<SubtitleStringsType>('disappearingMessages');

  const [subtitleStrings, setSubtitleStrings] = useState<SubtitleStrings>({});
  const [subtitleArray, setSubtitleArray] = useState<Array<SubtitleStringsType>>([]);

  const { i18n } = window;

  const notificationSubtitle = useMemo(
    () => (notificationSetting ? i18n('notificationSubtitle', [notificationSetting]) : null),
    [i18n, notificationSetting]
  );

  const memberCountSubtitle = useMemo(() => {
    let memberCount = 0;
    if (isGroup) {
      if (isPublic) {
        memberCount = subscriberCount || 0;
      } else {
        memberCount = members.length;
      }
    }

    if (isGroup && memberCount > 0 && !isKickedFromGroup) {
      const count = String(memberCount);
      return isPublic ? i18n('activeMembers', [count]) : i18n('members', [count]);
    }

    return null;
  }, [i18n, isGroup, isKickedFromGroup, isPublic, members.length, subscriberCount]);

  const handleRightPanelToggle = () => {
    if (isRightPanelOn) {
      dispatch(closeRightPanel());
      return;
    }

    // NOTE If disappearing messages is defined we must show it first
    if (visibleSubtitle === 'disappearingMessages') {
      dispatch(
        setRightOverlayMode({
          type: 'disappearing_messages',
          params: null,
        })
      );
    } else {
      dispatch(resetRightOverlayMode());
    }
    dispatch(openRightPanel());
  };

  useEffect(() => {
    if (visibleSubtitle !== 'disappearingMessages') {
      if (!isEmpty(disappearingMessageSubtitle)) {
        setVisibleSubtitle('disappearingMessages');
      } else {
        setVisibleSubtitle('notifications');
      }
    }
    // We only want this to change when a new conversation is selected or disappearing messages is toggled
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convoId, disappearingMessageSubtitle]);

  useEffect(() => {
    const newSubtitlesArray: any = [];
    const newSubtitlesStrings: any = {};

    if (disappearingMessageSubtitle) {
      newSubtitlesStrings.disappearingMessages = disappearingMessageSubtitle;
      newSubtitlesArray.push('disappearingMessages');
    }

    if (notificationSubtitle) {
      newSubtitlesStrings.notifications = notificationSubtitle;
      newSubtitlesArray.push('notifications');
    }

    if (memberCountSubtitle) {
      newSubtitlesStrings.members = memberCountSubtitle;
      newSubtitlesArray.push('members');
    }

    if (newSubtitlesArray.indexOf(visibleSubtitle) < 0) {
      setVisibleSubtitle('notifications');
    }

    setSubtitleStrings(newSubtitlesStrings);
    setSubtitleArray(newSubtitlesArray);
  }, [disappearingMessageSubtitle, memberCountSubtitle, notificationSubtitle, visibleSubtitle]);

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
                visibleSubtitle === 'disappearingMessages' && expirationMode !== 'off'
              }
            />
          )}
        </div>
      </div>
    </div>
  );
};
