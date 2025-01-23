// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';
import type { Props as AvatarProps } from '../Avatar';
import { Avatar, AvatarSize, AvatarBlur } from '../Avatar';
import { ContactName } from './ContactName';
import { About } from './About';
import { GroupDescription } from './GroupDescription';
import { SharedGroupNames } from '../SharedGroupNames';
import type { LocalizerType, ThemeType } from '../../types/Util';
import type { HasStories } from '../../types/Stories';
import type { ViewUserStoriesActionCreatorType } from '../../state/ducks/stories';
import { StoryViewModeType } from '../../types/Stories';
import { ConfirmationDialog } from '../ConfirmationDialog';
import { shouldBlurAvatar } from '../../util/shouldBlurAvatar';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser';
import { Button, ButtonVariant } from '../Button';
import { SafetyTipsModal } from '../SafetyTipsModal';

export type Props = {
  about?: string;
  acceptedMessageRequest?: boolean;
  groupDescription?: string;
  hasStories?: HasStories;
  id: string;
  i18n: LocalizerType;
  isMe: boolean;
  isSignalConversation?: boolean;
  membersCount?: number;
  phoneNumber?: string;
  sharedGroupNames?: ReadonlyArray<string>;
  unblurAvatar: (conversationId: string) => void;
  unblurredAvatarUrl?: string;
  updateSharedGroups: (conversationId: string) => unknown;
  theme: ThemeType;
  viewUserStories: ViewUserStoriesActionCreatorType;
  toggleAboutContactModal: (conversationId: string) => unknown;
} & Omit<AvatarProps, 'onClick' | 'size' | 'noteToSelf'>;

const renderMembershipRow = ({
  acceptedMessageRequest,
  conversationType,
  i18n,
  isMe,
  onClickMessageRequestWarning,
  onToggleSafetyTips,
  phoneNumber,
  sharedGroupNames,
}: Pick<
  Props,
  | 'acceptedMessageRequest'
  | 'conversationType'
  | 'i18n'
  | 'isMe'
  | 'phoneNumber'
> &
  Required<Pick<Props, 'sharedGroupNames'>> & {
    onClickMessageRequestWarning: () => void;
    onToggleSafetyTips: (showSafetyTips: boolean) => void;
  }) => {
  if (conversationType !== 'direct') {
    return null;
  }

  if (isMe) {
    return (
      <div className="module-conversation-hero__note-to-self">
        {i18n('icu:noteToSelfHero')}
      </div>
    );
  }

  const safetyTipsButton = (
    <div>
      <Button
        className="module-conversation-hero__safety-tips-button"
        variant={ButtonVariant.SecondaryAffirmative}
        onClick={() => {
          onToggleSafetyTips(true);
        }}
      >
        {i18n('icu:MessageRequestWarning__safety-tips')}
      </Button>
    </div>
  );

  if (sharedGroupNames.length > 0) {
    return (
      <div className="module-conversation-hero__membership">
        <i className="module-conversation-hero__membership__chevron" />
        <SharedGroupNames
          i18n={i18n}
          nameClassName="module-conversation-hero__membership__name"
          sharedGroupNames={sharedGroupNames}
        />
        {safetyTipsButton}
      </div>
    );
  }
  if (acceptedMessageRequest) {
    if (phoneNumber) {
      return null;
    }
    return (
      <div className="module-conversation-hero__membership">
        {i18n('icu:no-groups-in-common')}
        {safetyTipsButton}
      </div>
    );
  }

  return (
    <div className="module-conversation-hero__membership">
      <div className="module-conversation-hero__membership__warning">
        <i className="module-conversation-hero__membership__warning__icon" />
        <span>{i18n('icu:no-groups-in-common-warning')}</span>
        &nbsp;
        <button
          className="module-conversation-hero__membership__warning__learn-more"
          type="button"
          onClick={ev => {
            ev.preventDefault();
            onClickMessageRequestWarning();
          }}
        >
          {i18n('icu:MessageRequestWarning__learn-more')}
        </button>
      </div>
      {safetyTipsButton}
    </div>
  );
};

export function ConversationHero({
  i18n,
  about,
  acceptedMessageRequest,
  avatarUrl,
  badge,
  color,
  conversationType,
  groupDescription,
  hasStories,
  id,
  isMe,
  isSignalConversation,
  membersCount,
  sharedGroupNames = [],
  phoneNumber,
  profileName,
  theme,
  title,
  unblurAvatar,
  unblurredAvatarUrl,
  updateSharedGroups,
  viewUserStories,
  toggleAboutContactModal,
}: Props): JSX.Element {
  const [isShowingSafetyTips, setIsShowingSafetyTips] = useState(false);
  const [isShowingMessageRequestWarning, setIsShowingMessageRequestWarning] =
    useState(false);
  const closeMessageRequestWarning = () => {
    setIsShowingMessageRequestWarning(false);
  };

  useEffect(() => {
    // Kick off the expensive hydration of the current sharedGroupNames
    updateSharedGroups(id);
  }, [id, updateSharedGroups]);

  let avatarBlur: AvatarBlur = AvatarBlur.NoBlur;
  let avatarOnClick: undefined | (() => void);
  if (
    shouldBlurAvatar({
      acceptedMessageRequest,
      avatarUrl,
      isMe,
      sharedGroupNames,
      unblurredAvatarUrl,
    })
  ) {
    avatarBlur = AvatarBlur.BlurPictureWithClickToView;
    avatarOnClick = () => unblurAvatar(id);
  } else if (hasStories) {
    avatarOnClick = () => {
      viewUserStories({
        conversationId: id,
        storyViewMode: StoryViewModeType.User,
      });
    };
  }

  let titleElem: JSX.Element | undefined;

  if (isMe) {
    titleElem = <>{i18n('icu:noteToSelf')}</>;
  } else if (isSignalConversation || conversationType !== 'direct') {
    titleElem = (
      <ContactName isSignalConversation={isSignalConversation} title={title} />
    );
  } else if (title) {
    titleElem = (
      <button
        type="button"
        className="module-conversation-hero__title"
        onClick={ev => {
          ev.preventDefault();
          toggleAboutContactModal(id);
        }}
      >
        <ContactName title={title} />
        <i className="module-conversation-hero__title__chevron" />
      </button>
    );
  }

  /* eslint-disable no-nested-ternary */
  return (
    <>
      <div className="module-conversation-hero">
        <Avatar
          acceptedMessageRequest={acceptedMessageRequest}
          avatarUrl={avatarUrl}
          badge={badge}
          blur={avatarBlur}
          className="module-conversation-hero__avatar"
          color={color}
          conversationType={conversationType}
          i18n={i18n}
          isMe={isMe}
          noteToSelf={isMe}
          onClick={avatarOnClick}
          profileName={profileName}
          sharedGroupNames={sharedGroupNames}
          size={AvatarSize.EIGHTY}
          // user may have stories, but we don't show that on Note to Self conversation
          storyRing={isMe ? undefined : hasStories}
          theme={theme}
          title={title}
        />
        <h1 className="module-conversation-hero__profile-name">
          {titleElem}
          {isMe && <span className="ContactModal__official-badge__large" />}
        </h1>
        {about && !isMe && (
          <div className="module-about__container">
            <About text={about} />
          </div>
        )}
        {!isMe ? (
          <div className="module-conversation-hero__with">
            {groupDescription ? (
              <GroupDescription
                i18n={i18n}
                title={title}
                text={groupDescription}
              />
            ) : membersCount != null ? (
              i18n('icu:ConversationHero--members', { count: membersCount })
            ) : null}
          </div>
        ) : null}
        {!isSignalConversation &&
          renderMembershipRow({
            acceptedMessageRequest,
            conversationType,
            i18n,
            isMe,
            onClickMessageRequestWarning() {
              setIsShowingMessageRequestWarning(true);
            },
            onToggleSafetyTips(showSafetyTips: boolean) {
              setIsShowingSafetyTips(showSafetyTips);
            },
            phoneNumber,
            sharedGroupNames,
          })}
      </div>
      {isShowingMessageRequestWarning && (
        <ConfirmationDialog
          dialogName="ConversationHere.messageRequestWarning"
          i18n={i18n}
          onClose={closeMessageRequestWarning}
          actions={[
            {
              text: i18n('icu:MessageRequestWarning__dialog__learn-even-more'),
              action: () => {
                openLinkInWebBrowser(
                  'https://support.signal.org/hc/articles/360007459591'
                );
                closeMessageRequestWarning();
              },
            },
          ]}
        >
          {i18n('icu:MessageRequestWarning__dialog__details')}
        </ConfirmationDialog>
      )}

      {isShowingSafetyTips && (
        <SafetyTipsModal
          i18n={i18n}
          onClose={() => {
            setIsShowingSafetyTips(false);
          }}
        />
      )}
    </>
  );
  /* eslint-enable no-nested-ternary */
}
