// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type ReactNode, useState } from 'react';
import type { Props as AvatarProps } from '../Avatar.dom.tsx';
import { Avatar, AvatarSize, AvatarBlur } from '../Avatar.dom.tsx';
import { ContactName } from './ContactName.dom.tsx';
import { GroupDescription } from './GroupDescription.dom.tsx';
import { SharedGroupNames } from '../SharedGroupNames.dom.tsx';
import { GroupMembersNames } from '../GroupMembersNames.dom.tsx';
import type { LocalizerType, ThemeType } from '../../types/Util.std.ts';
import type { HasStories } from '../../types/Stories.std.ts';
import type { ViewUserStoriesActionCreatorType } from '../../state/ducks/stories.preload.ts';
import type { GroupV2Membership } from './conversation-details/ConversationDetailsMembershipList.dom.tsx';
import { StoryViewModeType } from '../../types/Stories.std.ts';
import { SafetyTipsModal } from '../SafetyTipsModal.dom.tsx';
import type { ContactModalStateType } from '../../types/globalModals.std.ts';
import { type TailwindStyles, tw } from '../../axo/tw.dom.tsx';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';
import { AxoButton } from '../../axo/AxoButton.dom.tsx';

export type Props = {
  about?: string;
  acceptedMessageRequest?: boolean;
  groupDescription?: string;
  hasAvatar?: boolean;
  hasNickname: boolean;
  hasProfileName: boolean;
  hasStories?: HasStories;
  id: string;
  i18n: LocalizerType;
  isGroupNameVerified: boolean;
  isInSystemContacts: boolean;
  isMe: boolean;
  invitesCount?: number;
  isSignalConversation?: boolean;
  membersCount?: number;
  memberships: ReadonlyArray<GroupV2Membership>;
  openConversationDetails?: () => unknown;
  pendingAvatarDownload?: boolean;
  sharedGroupNames?: ReadonlyArray<string>;
  startAvatarDownload: () => void;
  theme: ThemeType;
  viewUserStories: ViewUserStoriesActionCreatorType;
  toggleAboutContactModal: (options: ContactModalStateType) => unknown;
  toggleProfileNameWarningModal: (conversationType?: string) => unknown;
} & Omit<AvatarProps, 'onClick' | 'size' | 'noteToSelf'>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export function ConversationHero({
  avatarPlaceholderGradient,
  i18n,
  acceptedMessageRequest,
  avatarUrl,
  badge,
  color,
  conversationType,
  groupDescription,
  hasAvatar,
  hasNickname,
  hasProfileName,
  hasStories,
  id,
  isGroupNameVerified,
  isInSystemContacts,
  isMe,
  invitesCount,
  openConversationDetails,
  isSignalConversation,
  memberships,
  pendingAvatarDownload,
  profileName,
  sharedGroupNames = [],
  startAvatarDownload,
  theme,
  title,
  viewUserStories,
  toggleAboutContactModal,
  toggleProfileNameWarningModal,
}: Props): React.JSX.Element | null {
  const [isShowingSafetyTips, setIsShowingSafetyTips] = useState(false);

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

  const maybeSafetyTips = isShowingSafetyTips ? (
    <SafetyTipsModal
      i18n={i18n}
      onClose={() => {
        setIsShowingSafetyTips(false);
      }}
    />
  ) : null;

  const avatar = (
    <ConversationAvatar
      avatarPlaceholderGradient={avatarPlaceholderGradient}
      avatarUrl={avatarUrl}
      badge={badge}
      blur={avatarBlur}
      conversationType={conversationType}
      color={color}
      i18n={i18n}
      hasAvatar={hasAvatar}
      loading={pendingAvatarDownload && !avatarUrl}
      noteToSelf={isMe}
      onClick={avatarOnClick}
      profileName={profileName}
      storyRing={isMe ? undefined : hasStories}
      theme={theme}
      title={title}
    />
  );

  if (isMe) {
    return (
      <Root>
        {avatar}
        <Title title={i18n('icu:noteToSelf')} isMe />
        <div className={tw('my-2')}>
          <OfficialChatBadge i18n={i18n} />
        </div>
        <div
          className={tw('mt-2 text-center type-body-medium text-label-primary')}
        >
          {i18n('icu:noteToSelfHero')}
        </div>
      </Root>
    );
  }

  if (isSignalConversation) {
    return (
      <Root
        className={tw(
          'border-border-secondary bg-legacy-signal-conversation-bg'
        )}
      >
        {avatar}
        <Title title={title} isSignalConversation />
        <div className={tw('my-2')}>
          <OfficialChatBadge i18n={i18n} />
        </div>
        <div className={tw('text-center type-body-medium text-label-primary')}>
          {i18n('icu:ConversationHero--signal-official-account--description')}
        </div>
      </Root>
    );
  }

  if (conversationType === 'direct') {
    const nameIsVerified = hasNickname || isInSystemContacts;
    return (
      <Root>
        {avatar}
        <Title
          title={title}
          onClick={() => toggleAboutContactModal({ contactId: id })}
        />

        {hasProfileName && !nameIsVerified ? (
          <NameNotVerifiedWarning
            conversationType={conversationType}
            onClick={() => toggleProfileNameWarningModal(conversationType)}
            i18n={i18n}
          />
        ) : null}

        <div
          className={tw(
            'mt-2.5 text-center type-body-medium text-label-primary'
          )}
        >
          <AxoSymbol.InlineGlyph symbol="group" label={null} />
          &nbsp;
          <SharedGroupNames
            i18n={i18n}
            sharedGroupNames={sharedGroupNames ?? []}
          />
        </div>

        {!acceptedMessageRequest ? (
          <SafetyTips
            onShowSafetyTips={() => setIsShowingSafetyTips(true)}
            i18n={i18n}
          />
        ) : null}
        {maybeSafetyTips}
      </Root>
    );
  }

  if (conversationType === 'group') {
    return (
      <Root>
        {avatar}
        <Title title={title} />
        {!isGroupNameVerified ? (
          <NameNotVerifiedWarning
            conversationType={conversationType}
            onClick={() => toggleProfileNameWarningModal(conversationType)}
            i18n={i18n}
          />
        ) : null}

        {groupDescription ? (
          <div className={tw('mt-2 w-full text-center text-label-primary')}>
            <GroupDescription
              i18n={i18n}
              title={title}
              text={groupDescription}
            />
          </div>
        ) : null}

        <div
          className={tw(
            'mt-2.5 w-full text-center type-body-medium text-label-primary'
          )}
        >
          <AxoSymbol.InlineGlyph symbol="group" label={null} />
          &nbsp;
          <GroupMembersNames
            i18n={i18n}
            memberships={memberships}
            invitesCount={invitesCount}
            onOtherMembersClick={openConversationDetails}
          />
        </div>
        {!acceptedMessageRequest ? (
          <SafetyTips
            onShowSafetyTips={() => setIsShowingSafetyTips(true)}
            i18n={i18n}
          />
        ) : null}
        {maybeSafetyTips}
      </Root>
    );
  }
  return null;
}

type RootProps = {
  children: ReactNode;
  className?: TailwindStyles;
};
const Root: React.FC<RootProps> = props => {
  return (
    <div
      data-testid="conversation-hero"
      className={tw(
        'flex w-3xs flex-col items-center rounded-4xl border-2 border-border-secondary p-5 pt-0',
        props.className
      )}
    >
      {props.children}
    </div>
  );
};

const ConversationAvatar: React.FC<
  DistributiveOmit<AvatarProps, 'size'>
> = props => {
  return (
    <Avatar
      {...props}
      size={AvatarSize.SEVENTY_TWO}
      className={tw('-mt-4.5')}
    />
  );
};

type TitleProps = {
  isMe?: boolean;
  isSignalConversation?: boolean;
  title: string;
  onClick?: () => void;
};

const Title: React.FC<TitleProps> = props => {
  const className = tw('mt-3 text-center text-[20px] leading-6 font-medium');
  const { onClick, title, isMe, isSignalConversation } = props;
  const contactName = (
    <ContactName
      title={title}
      isMe={isMe}
      isSignalConversation={isSignalConversation}
    />
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={ev => {
          ev.preventDefault();
          onClick();
        }}
      >
        {contactName}
        &nbsp;
        <span className={tw('text-[18px] text-label-secondary')}>
          <AxoSymbol.InlineGlyph symbol="chevron-[end]" label={null} />
        </span>
      </button>
    );
  }

  return <div className={className}>{contactName}</div>;
};

const NameNotVerifiedWarning: React.FC<{
  conversationType: 'direct' | 'group';
  onClick: () => void;
  i18n: LocalizerType;
}> = ({ conversationType, onClick, i18n }) => {
  return (
    <button
      className={tw(
        'mt-2 rounded-3xl bg-color-fill-destructive/12 px-2.5 py-1',
        // oxlint-disable-next-line better-tailwindcss/no-restricted-classes
        'type-body-medium font-medium text-[#C84118] dark:bg-[#EB977D]/20 dark:text-[#EB977D]'
      )}
      type="button"
      onClick={ev => {
        ev.preventDefault();
        onClick();
      }}
    >
      {conversationType === 'direct' ? (
        <AxoSymbol.InlineGlyph symbol="person-question" label={null} />
      ) : (
        // TODO: DESKTOP-10050
        <AxoSymbol.InlineGlyph symbol="person-question" label={null} />
      )}
      &nbsp; {i18n('icu:ConversationHero--name-not-verified')}
    </button>
  );
};

const SafetyTips: React.FC<{
  onShowSafetyTips: () => void;
  i18n: LocalizerType;
}> = ({ i18n, onShowSafetyTips }) => {
  return (
    <div className={tw('mt-3')}>
      <AxoButton.Root variant="secondary" size="md" onClick={onShowSafetyTips}>
        {i18n('icu:MessageRequestWarning__safety-tips-v2')}
      </AxoButton.Root>
    </div>
  );
};

const OfficialChatBadge: React.FC<{
  i18n: LocalizerType;
}> = ({ i18n }) => {
  return (
    <div
      className={tw(
        'rounded-3xl bg-legacy-official-chat-badge-bg px-2.5 py-1',
        'type-body-medium font-medium text-legacy-official-chat-badge-text'
      )}
    >
      <AxoSymbol.InlineGlyph symbol="officialbadge" label={null} />
      &nbsp;
      {i18n('icu:ConversationHero--signal-official-chat-title')}
    </div>
  );
};
