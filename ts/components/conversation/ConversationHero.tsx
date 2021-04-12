// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { take } from 'lodash';
import { Avatar, Props as AvatarProps } from '../Avatar';
import { ContactName } from './ContactName';
import { About } from './About';
import { Emojify } from './Emojify';
import { Intl } from '../Intl';
import { LocalizerType } from '../../types/Util';

export type Props = {
  about?: string;
  i18n: LocalizerType;
  isMe?: boolean;
  sharedGroupNames?: Array<string>;
  membersCount?: number;
  phoneNumber?: string;
  onHeightChange?: () => unknown;
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
  const nameClassName = `${className}__name`;

  if (conversationType !== 'direct') {
    return null;
  }

  if (isMe) {
    return <div className={className}>{i18n('noteToSelfHero')}</div>;
  }

  if (sharedGroupNames.length > 0) {
    const firstThreeGroups = take(sharedGroupNames, 3).map((group, i) => (
      // We cannot guarantee uniqueness of group names
      // eslint-disable-next-line react/no-array-index-key
      <strong key={i} className={nameClassName}>
        <Emojify text={group} />
      </strong>
    ));

    if (sharedGroupNames.length > 3) {
      const remainingCount = sharedGroupNames.length - 3;
      return (
        <div className={className}>
          <Intl
            i18n={i18n}
            id="ConversationHero--membership-extra"
            components={{
              group1: firstThreeGroups[0],
              group2: firstThreeGroups[1],
              group3: firstThreeGroups[2],
              remainingCount: remainingCount.toString(),
            }}
          />
        </div>
      );
    }
    if (firstThreeGroups.length === 3) {
      return (
        <div className={className}>
          <Intl
            i18n={i18n}
            id="ConversationHero--membership-3"
            components={{
              group1: firstThreeGroups[0],
              group2: firstThreeGroups[1],
              group3: firstThreeGroups[2],
            }}
          />
        </div>
      );
    }
    if (firstThreeGroups.length >= 2) {
      return (
        <div className={className}>
          <Intl
            i18n={i18n}
            id="ConversationHero--membership-2"
            components={{
              group1: firstThreeGroups[0],
              group2: firstThreeGroups[1],
            }}
          />
        </div>
      );
    }
    if (firstThreeGroups.length >= 1) {
      return (
        <div className={className}>
          <Intl
            i18n={i18n}
            id="ConversationHero--membership-1"
            components={{
              group: firstThreeGroups[0],
            }}
          />
        </div>
      );
    }
  }

  if (!phoneNumber) {
    return <div className={className}>{i18n('no-groups-in-common')}</div>;
  }

  return null;
};

export const ConversationHero = ({
  i18n,
  about,
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

  const phoneNumberOnly = Boolean(
    !name && !profileName && conversationType === 'direct'
  );

  /* eslint-disable no-nested-ternary */
  return (
    <div className="module-conversation-hero">
      <Avatar
        i18n={i18n}
        color={color}
        noteToSelf={isMe}
        avatarPath={avatarPath}
        conversationType={conversationType}
        name={name}
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
