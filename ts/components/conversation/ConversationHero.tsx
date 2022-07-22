// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';
import type { Props as AvatarProps } from '../Avatar';
import { Avatar, AvatarBlur } from '../Avatar';
import { ContactName } from './ContactName';
import { About } from './About';
import { GroupDescription } from './GroupDescription';
import { SharedGroupNames } from '../SharedGroupNames';
import type { LocalizerType, ThemeType } from '../../types/Util';
import type { HasStories } from '../../types/Stories';
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
  membersCount?: number;
  phoneNumber?: string;
  sharedGroupNames?: Array<string>;
  unblurAvatar: () => void;
  unblurredAvatarPath?: string;
  updateSharedGroups: () => unknown;
  theme: ThemeType;
  viewUserStories: (cid: string) => unknown;
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
    return <div className={className}>{i18n('noteToSelfHero')}</div>;
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
    return <div className={className}>{i18n('no-groups-in-common')}</div>;
  }

  return (
    <div className="module-conversation-hero__message-request-warning">
      <div className="module-conversation-hero__message-request-warning__message">
        {i18n('no-groups-in-common-warning')}
      </div>
      <Button
        onClick={onClickMessageRequestWarning}
        size={ButtonSize.Small}
        variant={ButtonVariant.SecondaryAffirmative}
      >
        {i18n('MessageRequestWarning__learn-more')}
      </Button>
    </div>
  );
};

export const ConversationHero = ({
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
}: Props): JSX.Element => {
  const [isShowingMessageRequestWarning, setIsShowingMessageRequestWarning] =
    useState(false);
  const closeMessageRequestWarning = () => {
    setIsShowingMessageRequestWarning(false);
  };

  useEffect(() => {
    // Kick off the expensive hydration of the current sharedGroupNames
    updateSharedGroups();
  }, [updateSharedGroups]);

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
    avatarOnClick = unblurAvatar;
  } else if (hasStories) {
    avatarOnClick = () => {
      viewUserStories(id);
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
          name={name}
          noteToSelf={isMe}
          onClick={avatarOnClick}
          profileName={profileName}
          sharedGroupNames={sharedGroupNames}
          size={112}
          storyRing={hasStories}
          theme={theme}
          title={title}
        />
        <h1 className="module-conversation-hero__profile-name">
          {isMe ? i18n('noteToSelf') : <ContactName title={title} />}
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
            ) : membersCount === 1 ? (
              i18n('ConversationHero--members-1')
            ) : membersCount !== undefined ? (
              i18n('ConversationHero--members', [`${membersCount}`])
            ) : phoneNumberOnly ? null : (
              phoneNumber
            )}
          </div>
        ) : null}
        {renderMembershipRow({
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
        <div className="module-conversation-hero__linkNotification">
          {i18n('messageHistoryUnsynced')}
        </div>
      </div>
      {isShowingMessageRequestWarning && (
        <ConfirmationDialog
          i18n={i18n}
          onClose={closeMessageRequestWarning}
          actions={[
            {
              text: i18n('MessageRequestWarning__dialog__learn-even-more'),
              action: () => {
                openLinkInWebBrowser(
                  'https://support.signal.org/hc/articles/360007459591'
                );
                closeMessageRequestWarning();
              },
            },
          ]}
        >
          {i18n('MessageRequestWarning__dialog__details')}
        </ConfirmationDialog>
      )}
    </>
  );
  /* eslint-enable no-nested-ternary */
};
