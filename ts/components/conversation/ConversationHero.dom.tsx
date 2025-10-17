// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type ReactNode, useEffect, useState } from 'react';
import classNames from 'classnames';
import type { Props as AvatarProps } from '../Avatar.dom.js';
import { Avatar, AvatarSize, AvatarBlur } from '../Avatar.dom.js';
import { ContactName } from './ContactName.dom.js';
import { About } from './About.dom.js';
import { GroupDescription } from './GroupDescription.dom.js';
import { SharedGroupNames } from '../SharedGroupNames.dom.js';
import { GroupMembersNames } from '../GroupMembersNames.dom.js';
import type { LocalizerType, ThemeType } from '../../types/Util.std.js';
import type { HasStories } from '../../types/Stories.std.js';
import type { ViewUserStoriesActionCreatorType } from '../../state/ducks/stories.preload.js';
import type { GroupV2Membership } from './conversation-details/ConversationDetailsMembershipList.dom.js';
import { StoryViewModeType } from '../../types/Stories.std.js';
import { Button, ButtonVariant } from '../Button.dom.js';
import { SafetyTipsModal } from '../SafetyTipsModal.dom.js';
import { I18n } from '../I18n.dom.js';

export type Props = {
  about?: string;
  acceptedMessageRequest?: boolean;
  fromOrAddedByTrustedContact?: boolean;
  groupDescription?: string;
  hasAvatar?: boolean;
  hasStories?: HasStories;
  id: string;
  i18n: LocalizerType;
  isDirectConvoAndHasNickname?: boolean;
  isMe: boolean;
  invitesCount?: number;
  isSignalConversation?: boolean;
  membersCount?: number;
  memberships: ReadonlyArray<GroupV2Membership>;
  openConversationDetails?: () => unknown;
  pendingAvatarDownload?: boolean;
  phoneNumber?: string;
  sharedGroupNames?: ReadonlyArray<string>;
  startAvatarDownload: () => void;
  updateSharedGroups: (conversationId: string) => unknown;
  theme: ThemeType;
  viewUserStories: ViewUserStoriesActionCreatorType;
  toggleAboutContactModal: (conversationId: string) => unknown;
  toggleProfileNameWarningModal: (conversationType?: string) => unknown;
} & Omit<AvatarProps, 'onClick' | 'size' | 'noteToSelf'>;

const renderExtraInformation = ({
  acceptedMessageRequest,
  conversationType,
  fromOrAddedByTrustedContact,
  i18n,
  isDirectConvoAndHasNickname,
  isMe,
  invitesCount,
  memberships,
  onClickProfileNameWarning,
  onToggleSafetyTips,
  openConversationDetails,
  phoneNumber,
  sharedGroupNames,
}: Pick<
  Props,
  | 'avatarPlaceholderGradient'
  | 'acceptedMessageRequest'
  | 'conversationType'
  | 'fromOrAddedByTrustedContact'
  | 'i18n'
  | 'isDirectConvoAndHasNickname'
  | 'isMe'
  | 'invitesCount'
  | 'membersCount'
  | 'memberships'
  | 'openConversationDetails'
  | 'phoneNumber'
> &
  Required<Pick<Props, 'sharedGroupNames'>> & {
    onClickProfileNameWarning: () => void;
    onToggleSafetyTips: (showSafetyTips: boolean) => void;
  }) => {
  if (conversationType !== 'direct' && conversationType !== 'group') {
    return null;
  }

  if (isMe) {
    return (
      <div className="module-conversation-hero__note-to-self">
        {i18n('icu:noteToSelfHero')}
      </div>
    );
  }

  const safetyTipsButton = !acceptedMessageRequest ? (
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
  ) : null;

  const shouldShowReviewCarefully =
    !acceptedMessageRequest &&
    (conversationType === 'group' || sharedGroupNames.length <= 1);

  const reviewCarefullyLabel = shouldShowReviewCarefully ? (
    <div className="module-conversation-hero__review-carefully">
      <i className="module-conversation-hero__membership__review-carefully-icon" />
      {i18n('icu:ConversationHero--review-carefully')}
    </div>
  ) : null;

  const sharedGroupsLabel =
    conversationType === 'direct' ? (
      <div>
        <i className="module-conversation-hero__membership__chevron" />
        <SharedGroupNames
          i18n={i18n}
          nameClassName="module-conversation-hero__membership__name"
          sharedGroupNames={sharedGroupNames}
        />
      </div>
    ) : null;

  const nameNotVerifiedLabel =
    !fromOrAddedByTrustedContact && !isDirectConvoAndHasNickname ? (
      <div className="module-conversation-hero__name-not-verified">
        <i
          className={classNames({
            'module-conversation-hero__group-question-icon':
              conversationType === 'group',
            'module-conversation-hero__direct-question-icon':
              conversationType === 'direct',
          })}
        />
        <I18n
          components={{
            clickable: (parts: ReactNode) => (
              <button
                className="module-conversation-hero__name-not-verified__button"
                type="button"
                onClick={ev => {
                  ev.preventDefault();
                  onClickProfileNameWarning();
                }}
              >
                {parts}
              </button>
            ),
          }}
          i18n={i18n}
          id={
            conversationType === 'group'
              ? 'icu:ConversationHero--group-names'
              : 'icu:ConversationHero--profile-names'
          }
        />
      </div>
    ) : null;

  const membersCountLabel =
    conversationType === 'group' ? (
      <div className="module-conversation-hero__membership__members-count">
        <i className="module-conversation-hero__members-count-icon" />
        <GroupMembersNames
          i18n={i18n}
          nameClassName="module-conversation-hero__membership__name"
          memberships={memberships}
          invitesCount={invitesCount}
          onOtherMembersClick={openConversationDetails}
        />
      </div>
    ) : null;

  if (
    conversationType === 'direct' &&
    sharedGroupNames.length === 0 &&
    acceptedMessageRequest &&
    phoneNumber
  ) {
    return null;
  }

  // Check if we should show anything at all
  const shouldShowAnything =
    Boolean(reviewCarefullyLabel) ||
    Boolean(nameNotVerifiedLabel) ||
    Boolean(sharedGroupsLabel) ||
    Boolean(safetyTipsButton) ||
    Boolean(membersCountLabel);

  if (!shouldShowAnything) {
    return null;
  }

  return (
    <div className="module-conversation-hero__membership">
      {reviewCarefullyLabel}
      {nameNotVerifiedLabel}
      {sharedGroupsLabel}
      {membersCountLabel}
      {safetyTipsButton}
    </div>
  );
};

function ReleaseNotesExtraInformation({
  i18n,
}: {
  i18n: LocalizerType;
}): JSX.Element {
  return (
    <div className="module-conversation-hero--release-notes-notice">
      <div className="module-conversation-hero__release-notes-notice-content">
        <i className="module-conversation-hero__release-notes-notice-check-icon" />
        {i18n('icu:ConversationHero--signal-official-chat')}
      </div>
      <div className="module-conversation-hero__release-notes-notice-content">
        <i className="module-conversation-hero__release-notes-notice-bell-icon" />
        {i18n('icu:ConversationHero--release-notes')}
      </div>
    </div>
  );
}

export function ConversationHero({
  avatarPlaceholderGradient,
  i18n,
  about,
  acceptedMessageRequest,
  avatarUrl,
  badge,
  color,
  conversationType,
  fromOrAddedByTrustedContact,
  groupDescription,
  hasAvatar,
  hasStories,
  id,
  isDirectConvoAndHasNickname,
  isMe,
  invitesCount,
  openConversationDetails,
  isSignalConversation,
  membersCount,
  memberships,
  pendingAvatarDownload,
  sharedGroupNames = [],
  phoneNumber,
  profileName,
  startAvatarDownload,
  theme,
  title,
  updateSharedGroups,
  viewUserStories,
  toggleAboutContactModal,
  toggleProfileNameWarningModal,
}: Props): JSX.Element {
  const [isShowingSafetyTips, setIsShowingSafetyTips] = useState(false);

  useEffect(() => {
    // Kick off the expensive hydration of the current sharedGroupNames
    updateSharedGroups(id);
  }, [id, updateSharedGroups]);

  let avatarBlur: AvatarBlur = AvatarBlur.NoBlur;
  let avatarOnClick: undefined | (() => void);

  if (!avatarUrl && !isMe && hasAvatar) {
    avatarBlur = AvatarBlur.BlurPictureWithClickToView;
    avatarOnClick = () => {
      if (!pendingAvatarDownload) {
        startAvatarDownload();
      }
    };
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
    titleElem = (
      <ContactName
        isMe={isMe}
        title={i18n('icu:noteToSelf')}
        largeVerifiedBadge={isMe}
      />
    );
  } else if (isSignalConversation || conversationType !== 'direct') {
    titleElem = (
      <ContactName
        isSignalConversation={isSignalConversation}
        title={title}
        largeVerifiedBadge={isSignalConversation}
      />
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

  return (
    <>
      <div className="module-conversation-hero">
        <Avatar
          avatarPlaceholderGradient={avatarPlaceholderGradient}
          avatarUrl={avatarUrl}
          badge={badge}
          blur={avatarBlur}
          className="module-conversation-hero__avatar"
          color={color}
          conversationType={conversationType}
          i18n={i18n}
          hasAvatar={hasAvatar}
          loading={pendingAvatarDownload && !avatarUrl}
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
        <h1 className="module-conversation-hero__profile-name">{titleElem}</h1>
        {about && !isMe && (
          <div className="module-about__container">
            <About text={about} />
          </div>
        )}
        {!isMe && groupDescription ? (
          <div className="module-conversation-hero__with">
            <GroupDescription
              i18n={i18n}
              title={title}
              text={groupDescription}
            />
          </div>
        ) : null}
        {!isSignalConversation &&
          renderExtraInformation({
            acceptedMessageRequest,
            conversationType,
            fromOrAddedByTrustedContact,
            i18n,
            isDirectConvoAndHasNickname,
            isMe,
            invitesCount,
            membersCount,
            memberships,
            onClickProfileNameWarning() {
              toggleProfileNameWarningModal(conversationType);
            },
            onToggleSafetyTips(showSafetyTips: boolean) {
              setIsShowingSafetyTips(showSafetyTips);
            },
            openConversationDetails,
            phoneNumber,
            sharedGroupNames,
          })}
        {isSignalConversation && <ReleaseNotesExtraInformation i18n={i18n} />}
      </div>

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
}
