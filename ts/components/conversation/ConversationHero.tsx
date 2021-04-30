// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { Avatar, AvatarBlur, Props as AvatarProps } from '../Avatar';
import { ContactName } from './ContactName';
import { About } from './About';
import { SharedGroupNames } from '../SharedGroupNames';
import { LocalizerType } from '../../types/Util';
import { shouldBlurAvatar } from '../../util/shouldBlurAvatar';

export type Props = {
  about?: string;
  acceptedMessageRequest?: boolean;
  i18n: LocalizerType;
  isMe?: boolean;
  sharedGroupNames?: Array<string>;
  membersCount?: number;
  phoneNumber?: string;
  onHeightChange?: () => unknown;
  unblurAvatar: () => void;
  unblurredAvatarPath?: string;
  updateSharedGroups?: () => unknown;
} & Omit<AvatarProps, 'onClick' | 'size' | 'noteToSelf'>;

const renderMembershipRow = ({
  i18n,
  phoneNumber,
  sharedGroupNames = [],
  conversationType,
  isMe,
}: Pick<
  Props,
  'i18n' | 'phoneNumber' | 'sharedGroupNames' | 'conversationType' | 'isMe'
>) => {
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

  if (!phoneNumber) {
    return <div className={className}>{i18n('no-groups-in-common')}</div>;
  }

  return null;
};

export const ConversationHero = ({
  i18n,
  about,
  acceptedMessageRequest,
  avatarPath,
  color,
  conversationType,
  isMe,
  membersCount,
  sharedGroupNames = [],
  name,
  phoneNumber,
  profileName,
  title,
  onHeightChange,
  unblurAvatar,
  unblurredAvatarPath,
  updateSharedGroups,
}: Props): JSX.Element => {
  const firstRenderRef = React.useRef(true);

  // TODO: DESKTOP-686
  /* eslint-disable react-hooks/exhaustive-deps */
  React.useEffect(() => {
    // If any of the depenencies for this hook change then the height of this
    // component may have changed. The cleanup function notifies listeners of
    // any potential height changes.
    return () => {
      // Kick off the expensive hydration of the current sharedGroupNames
      if (updateSharedGroups) {
        updateSharedGroups();
      }

      if (onHeightChange && !firstRenderRef.current) {
        onHeightChange();
      } else {
        firstRenderRef.current = false;
      }
    };
  }, [
    firstRenderRef,
    onHeightChange,
    // Avoid collisions in these dependencies by prefixing them
    // These dependencies may be dynamic, and therefore may cause height changes
    `mc-${membersCount}`,
    `n-${name}`,
    `pn-${profileName}`,
    sharedGroupNames.map(g => `g-${g}`).join(' '),
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */

  let avatarBlur: AvatarBlur;
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
  } else {
    avatarBlur = AvatarBlur.NoBlur;
  }

  const phoneNumberOnly = Boolean(
    !name && !profileName && conversationType === 'direct'
  );

  /* eslint-disable no-nested-ternary */
  return (
    <div className="module-conversation-hero">
      <Avatar
        i18n={i18n}
        blur={avatarBlur}
        color={color}
        noteToSelf={isMe}
        avatarPath={avatarPath}
        conversationType={conversationType}
        name={name}
        onClick={avatarOnClick}
        profileName={profileName}
        title={title}
        size={112}
        className="module-conversation-hero__avatar"
      />
      <h1 className="module-conversation-hero__profile-name">
        {isMe ? (
          i18n('noteToSelf')
        ) : (
          <ContactName
            title={title}
            name={name}
            profileName={profileName}
            phoneNumber={phoneNumber}
            i18n={i18n}
          />
        )}
      </h1>
      {about && !isMe && (
        <div className="module-about__container">
          <About text={about} />
        </div>
      )}
      {!isMe ? (
        <div className="module-conversation-hero__with">
          {membersCount === 1
            ? i18n('ConversationHero--members-1')
            : membersCount !== undefined
            ? i18n('ConversationHero--members', [`${membersCount}`])
            : phoneNumberOnly
            ? null
            : phoneNumber}
        </div>
      ) : null}
      {renderMembershipRow({
        conversationType,
        i18n,
        isMe,
        phoneNumber,
        sharedGroupNames,
      })}
    </div>
  );
  /* eslint-enable no-nested-ternary */
};
