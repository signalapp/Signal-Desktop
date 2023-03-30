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
import { Button, ButtonSize, ButtonVariant } from '../Button';
import { shouldBlurAvatar } from '../../util/shouldBlurAvatar';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser';

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
  name?: string;
  phoneNumber?: string;
  sharedGroupNames?: ReadonlyArray<string>;
  unblurAvatar: (conversationId: string) => void;
  unblurredAvatarPath?: string;
  updateSharedGroups: (conversationId: string) => unknown;
  theme: ThemeType;
  viewUserStories: ViewUserStoriesActionCreatorType;
} & Omit<AvatarProps, 'onClick' | 'size' | 'noteToSelf'>;

const renderMembershipRow = ({
  acceptedMessageRequest,
  conversationType,
  i18n,
  isMe,
  onClickMessageRequestWarning,
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
  }) => {
  const className = 'module-conversation-hero__membership';

  if (conversationType !== 'direct') {
    return null;
  }

  if (isMe) {
    return <div className={className}>{i18n('icu:noteToSelfHero')}</div>;
  }

  if (sharedGroupNames.length > 0) {
    return (
      <div className={className}>
        <SharedGroupNames
          i18n={i18n}
          nameClassName={`${className}__name`}
          sharedGroupNames={sharedGroupNames}
        />
      </div>
    );
  }
  if (acceptedMessageRequest) {
    if (phoneNumber) {
      return null;
    }
    return <div className={className}>{i18n('icu:no-groups-in-common')}</div>;
  }

  return (
    <div className="module-conversation-hero__message-request-warning">
      <div className="module-conversation-hero__message-request-warning__message">
        {i18n('icu:no-groups-in-common-warning')}
      </div>
      <Button
        onClick={onClickMessageRequestWarning}
        size={ButtonSize.Small}
        variant={ButtonVariant.SecondaryAffirmative}
      >
        {i18n('icu:MessageRequestWarning__learn-more')}
      </Button>
    </div>
  );
};

export function ConversationHero({
  i18n,
  about,
  acceptedMessageRequest,
  avatarPath,
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
  name,
  phoneNumber,
  profileName,
  theme,
  title,
  unblurAvatar,
  unblurredAvatarPath,
  updateSharedGroups,
  viewUserStories,
}: Props): JSX.Element {
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
      avatarPath,
      isMe,
      sharedGroupNames,
      unblurredAvatarPath,
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

  const phoneNumberOnly = Boolean(
    !name && !profileName && conversationType === 'direct'
  );

  /* eslint-disable no-nested-ternary */
  return (
    <>
      <div className="module-conversation-hero">
        <Avatar
          acceptedMessageRequest={acceptedMessageRequest}
          avatarPath={avatarPath}
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
          {isMe ? (
            i18n('icu:noteToSelf')
          ) : (
            <ContactName
              isSignalConversation={isSignalConversation}
              title={title}
            />
          )}
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
            ) : phoneNumberOnly ? null : (
              phoneNumber
            )}
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
            phoneNumber,
            sharedGroupNames,
          })}
        {!isSignalConversation && (
          <div className="module-conversation-hero__linkNotification">
            {i18n('icu:messageHistoryUnsynced')}
          </div>
        )}
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
    </>
  );
  /* eslint-enable no-nested-ternary */
}
