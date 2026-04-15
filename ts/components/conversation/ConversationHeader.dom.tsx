// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { RefObject, JSX, ReactNode } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReadonlyDeep } from 'type-fest';
import type { BadgeType } from '../../badges/types.std.ts';
import {
  useKeyboardShortcuts,
  useStartCallShortcuts,
} from '../../hooks/useKeyboardShortcuts.dom.tsx';
import type { ConversationTypeType } from '../../state/ducks/conversations.preload.ts';
import type { HasStories } from '../../types/Stories.std.ts';
import type { LocalizerType, ThemeType } from '../../types/Util.std.ts';
import type { DurationInSeconds } from '../../util/durations/index.std.ts';
import * as expirationTimer from '../../util/expirationTimer.std.ts';
import { getMuteOptions } from '../../util/getMuteOptions.std.ts';
import { isConversationMuted } from '../../util/isConversationMuted.std.ts';
import { isInSystemContacts } from '../../util/isInSystemContacts.std.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import { Avatar, AvatarSize } from '../Avatar.dom.tsx';
import { DisappearingTimeDialog } from '../DisappearingTimeDialog.dom.tsx';
import { InContactsIcon } from '../InContactsIcon.dom.tsx';
import { UserText } from '../UserText.dom.tsx';
import type { ContactNameData } from './ContactName.dom.tsx';
import {
  MessageRequestActionsConfirmation,
  MessageRequestState,
} from './MessageRequestActionsConfirmation.dom.tsx';
import type { MinimalConversation } from '../../hooks/useMinimalConversation.std.ts';
import { InAnotherCallTooltip } from './InAnotherCallTooltip.dom.tsx';
import { DeleteMessagesConfirmationDialog } from '../DeleteMessagesConfirmationDialog.dom.tsx';
import { AxoDropdownMenu } from '../../axo/AxoDropdownMenu.dom.tsx';
import { strictAssert } from '../../util/assert.std.ts';
import {
  TimelineWarning,
  TimelineWarningCustomInfo,
  TimelineWarningLink,
} from './TimelineWarning.dom.tsx';
import { ContactSpoofingType } from '../../util/contactSpoofing.std.ts';
import type { GroupNameCollisionsWithIdsByTitle } from '../../util/groupMemberNameCollisions.std.ts';
import { hasUnacknowledgedCollisions } from '../../util/groupMemberNameCollisions.std.ts';
import type { I18nComponentParts } from '../I18n.dom.tsx';
import { I18n } from '../I18n.dom.tsx';
import type { SmartCollidingAvatarsProps } from '../../state/smart/CollidingAvatars.dom.tsx';
import type {
  ContactSpoofingWarning,
  MultipleGroupMembersWithSameTitleContactSpoofingWarning,
} from '../../state/selectors/timeline.preload.ts';
import { tw } from '../../axo/tw.dom.tsx';
import { AxoDragRegion } from '../../axo/AxoDragRegion.dom.tsx';
import { OfficialChatInlineBadge } from './OfficialChatInlineBadge.dom.tsx';
import { AxoIconButton } from '../../axo/AxoIconButton.dom.tsx';
import { AxoButton } from '../../axo/AxoButton.dom.tsx';
import { AxoConfirmDialog } from '../../axo/AxoConfirmDialog.dom.tsx';
import { generateSafetyNumber } from '../../util/safetyNumber.preload.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';
import { signalProtocolStore } from '../../SignalProtocolStore.preload.js';

function HeaderInfoTitle({
  name,
  title,
  type,
  i18n,
  isMe,
  isSignalConversation,
  headerRef,
}: {
  name: string | null;
  title: string;
  type: ConversationTypeType;
  i18n: LocalizerType;
  isMe: boolean;
  isSignalConversation: boolean;
  headerRef: RefObject<HTMLDivElement | null>;
  showSAS: string;
}) {
  if (isSignalConversation) {
    return (
      <div className="module-ConversationHeader__header__info__title">
        <UserText text={title} />
        &nbsp;
        <OfficialChatInlineBadge />
      </div>
    );
  }

  if (isMe) {
    return (
      <div className="module-ConversationHeader__header__info__title">
        {i18n('icu:noteToSelf')}
        &nbsp;
        <OfficialChatInlineBadge />
      </div>
    );
  }

  return (
    <div className="module-ConversationHeader__header__info__title">
      <UserText text={title} />
      {isInSystemContacts({ name: name ?? undefined, type }) ? (
        <InContactsIcon
          className="module-ConversationHeader__header__info__title__in-contacts-icon"
          i18n={i18n}
          tooltipContainerRef={headerRef}
        />
      ) : null}
    </div>
  );
  
}

export enum OutgoingCallButtonStyle {
  None,
  JustVideo,
  Both,
  Join,
}

export type RenderCollidingAvatars = (
  props: SmartCollidingAvatarsProps
) => JSX.Element;

export type RenderMiniPlayer = (options: {
  shouldFlow: boolean;
}) => JSX.Element;
export type RenderPinnedMessagesBar = () => JSX.Element;

export type AcknowledgeGroupMemberNameCollisions = (
  conversationId: string,
  groupNameCollisions: ReadonlyDeep<GroupNameCollisionsWithIdsByTitle>
) => void;

export type ReviewConversationNameCollission = () => void;

export type PropsDataType = {
  addedByName: ContactNameData | null;
  badge?: BadgeType;
  cannotLeaveBecauseYouAreLastAdmin: boolean;
  conversation: MinimalConversation;
  conversationName: ContactNameData;
  hasPanelShowing?: boolean;
  hasStories?: HasStories;
  hasActiveCall?: boolean;
  isMissingMandatoryProfileSharing?: boolean;
  isSelectMode: boolean;
  isSignalConversation?: boolean;
  isSmsOnlyOrUnregistered?: boolean;
  outgoingCallButtonStyle: OutgoingCallButtonStyle;
  theme: ThemeType;

  contactSpoofingWarning: ContactSpoofingWarning | null;
  renderCollidingAvatars: RenderCollidingAvatars;

  shouldShowMiniPlayer: boolean;
  renderMiniPlayer: RenderMiniPlayer;

  renderPinnedMessagesBar: RenderPinnedMessagesBar;
};

export type PropsActionsType = {
  onConversationAccept: () => void;
  onConversationArchive: () => void;
  onConversationBlock: () => void;
  onConversationBlockAndReportSpam: () => void;
  onConversationDelete: () => void;
  onConversationDeleteMessages: () => void;
  onConversationDisappearingMessagesChange: (
    seconds: DurationInSeconds
  ) => void;
  onConversationLeaveGroup: () => void;
  onConversationMarkUnread: () => void;
  onConversationMuteExpirationChange: (seconds: number) => void;
  onConversationPin: () => void;
  onConversationUnpin: () => void;
  onConversationReportSpam: () => void;
  onConversationUnarchive: () => void;
  onOutgoingAudioCall: () => void;
  onOutgoingVideoCall: () => void;
  onSearchInConversation: () => void;
  onSelectModeEnter: () => void;
  onShowMembers: () => void;
  onViewAllMedia: () => void;
  onViewConversationDetails: () => void;
  onViewUserStories: () => void;

  acknowledgeGroupMemberNameCollisions: AcknowledgeGroupMemberNameCollisions;
  reviewConversationNameCollision: ReviewConversationNameCollission;
};

export type PropsHousekeepingType = {
  i18n: LocalizerType;
};

export type PropsType = PropsDataType &
  PropsActionsType &
  PropsHousekeepingType;

export const ConversationHeader = memo(function ConversationHeader({
  addedByName,
  badge,
  cannotLeaveBecauseYouAreLastAdmin,
  conversation,
  conversationName,
  hasActiveCall,
  hasPanelShowing,
  hasStories,
  i18n,
  isMissingMandatoryProfileSharing,
  isSelectMode,
  isSignalConversation,
  isSmsOnlyOrUnregistered,
  onConversationAccept,
  onConversationArchive,
  onConversationBlock,
  onConversationBlockAndReportSpam,
  onConversationDelete,
  onConversationDeleteMessages,
  onConversationDisappearingMessagesChange,
  onConversationLeaveGroup,
  onConversationMarkUnread,
  onConversationMuteExpirationChange,
  onConversationPin,
  onConversationReportSpam,
  onConversationUnarchive,
  onConversationUnpin,
  onOutgoingAudioCall,
  onOutgoingVideoCall,
  onSearchInConversation,
  onSelectModeEnter,
  onShowMembers,
  onViewAllMedia,
  onViewConversationDetails,
  onViewUserStories,
  outgoingCallButtonStyle,
  theme,

  contactSpoofingWarning,
  acknowledgeGroupMemberNameCollisions,
  reviewConversationNameCollision,
  renderCollidingAvatars,

  shouldShowMiniPlayer,
  renderMiniPlayer,

  renderPinnedMessagesBar,
}: PropsType): JSX.Element | null {
  // Comes from a third-party dependency
  const headerRef = useRef<HTMLDivElement>(null);

  const [
    hasCustomDisappearingTimeoutModal,
    setHasCustomDisappearingTimeoutModal,
  ] = useState(false);
  const [hasDeleteMessagesConfirmation, setHasDeleteMessagesConfirmation] =
    useState(false);
  const [hasLeaveGroupConfirmation, setHasLeaveGroupConfirmation] =
    useState(false);
  const [
    hasCannotLeaveGroupBecauseYouAreLastAdminAlert,
    setHasCannotLeaveGroupBecauseYouAreLastAdminAlert,
  ] = useState(false);
  const [messageRequestState, setMessageRequestState] = useState(
    MessageRequestState.default
  );

  const [sasNumber, setSasNumber] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberName, setSelectedMemberName] = useState<string | null>(null);
  const [showGroupSASModal, setShowGroupSASModal] = useState(false);

  // user device name
  const ourDeviceName = itemStorage.get('device_name');
  console.log('Our device name:', ourDeviceName);

  const handleShowSASModal = useCallback(async () => {
    console.log('handleShowSASModal called for conversation:', conversation.id, 'type:', conversation.type);
  if (conversation.type === 'group') {
    setShowGroupSASModal(true);
    return;
  }

  try {
    const fullConversation = window.ConversationController.get(conversation.id)?.format();
    if (!fullConversation) {
      console.error('Could not find full conversation');
      return;
    }
    if (!fullConversation.serviceId) {
      console.error('Contact has no serviceId');
      return;
    }

    // temporary to check for device IDs
    const ourConversationId = window.ConversationController.getOurConversationId();
    const ourConversation = ourConversationId
      ? window.ConversationController.get(ourConversationId)
      : null;
    const ourAci = ourConversation?.get('serviceId');
    console.log('Our ACI:', ourAci);
    console.log('Their serviceId:', fullConversation.serviceId);

    if (ourAci) {
      try {
        const deviceIds = await signalProtocolStore.getDeviceIds({
          ourServiceId: ourAci as any,
          serviceId: fullConversation.serviceId as any,
        });
        console.log('Their device IDs:', deviceIds);
        deviceIds.forEach((id: number) => {
          console.log(`  Device ${id}: ${id === 1 ? 'Primary Device (Phone)' : `Linked Device ${id}`}`);
        });
      } catch (deviceErr) {
        console.error('Failed to get device IDs:', deviceErr);
      }
    }
    // end check

    const result = await generateSafetyNumber(fullConversation);
    const total = result.numberBlocks.reduce((sum, block) => sum + parseInt(block, 10), 0) % 1000000;
    setSasNumber(total.toString().padStart(6, '0'));
  } catch (err) {
    console.error('Failed to generate safety number', err);
  }
}, [conversation]);

  const handleVerifyMember = useCallback(async (memberId: string) => {
    try {
      const fullConversation = window.ConversationController.get(memberId)?.format();
      if (!fullConversation?.serviceId) return;
      const result = await generateSafetyNumber(fullConversation);
      setSelectedMemberId(memberId);
      const memberName = groupMembers.find(m => m.id === memberId)?.name ?? 'Unknown';
      setSelectedMemberName(memberName);
      const total = result.numberBlocks.reduce((sum, block) => sum + parseInt(block, 10), 0) % 1000000;
      setSasNumber(total.toString().padStart(6, '0'));
      setShowGroupSASModal(false);
    } catch (err) {
      console.error('Failed to generate safety number', err);
    }
  }, []);

  const groupMembers = useMemo(() => {
    if (conversation.type !== 'group') return [];
    try {
      const conv = window.ConversationController.get(conversation.id);
      if (!conv) return [];
      const ourConversationId = window.ConversationController.getOurConversationId();
      const ourConversation = ourConversationId ? window.ConversationController.get(ourConversationId) : null;
      const ourAci = ourConversation?.get('serviceId');
      const ourE164 = ourConversation?.get('e164');

      // const members = conv.getMembers?.({ includePendingMembers: true }) ??
      //                 conv.get('membersV2') ??
      //                 conv.get('members') ??
      //                 [];

      const memberIds: Array<string> = (conv.get('membersV2') ?? []).map((m: any) => m.aci ?? m.uuid ?? m.id)
      .concat(conv.get('members') ?? [])
      .filter((id: string, index: number, arr: Array<string>) => arr.indexOf(id) === index);
      // conv.getMembers() contain all non blocked members
      // conv.get('membersV2') contain all members but not the conversationType id but in UUIDs format?
      // conv.get('members') is undefined?

      return memberIds
        .filter((id: string) => {
          if (id === ourConversationId) return false;
          if (ourAci && id === ourAci) return false;
          if (ourE164 && id === ourE164) return false;
          const memberConv = window.ConversationController.get(id);
          const memberServiceId = memberConv?.get('serviceId');
          if (ourAci && ourAci === memberServiceId) return false;
          return true;
        })
        .map((id: string) => {
          const memberConv = window.ConversationController.get(id);
          return {
            id,
            name: memberConv?.get('profileName') ?? memberConv?.get('name') ?? memberConv?.get('e164') ?? id ?? 'Unknown',
            isBlocked: memberConv?.isBlocked() === true,
          }
        })
      
    } catch (err) {
      console.error('Failed to get group members', err);
      return [];
    }
  }, [conversation.id, conversation.type]);

  const [sasVerified, setSasVerified] = useState(false);
  useEffect(() => {
    try {
      const verifiedMap = (itemStorage.get('sas-verified-conversations') ?? {}) as Record<string, boolean>;
      if (conversation.type === 'group') {
        const allVerified = groupMembers.length > 0 && groupMembers.every(m => {
          if (m.isBlocked) return false;
          return verifiedMap[m.id] === true;
        });
        setSasVerified(allVerified);
      } else {
        setSasVerified(verifiedMap[conversation.id] === true);
      }
    } catch (err) {
      console.error('Failed to check SAS verified status', err);
      setSasVerified(false);
    }
  }, [conversation.id, conversation.type]);

  const handleSASNumbersMatch = useCallback(() => {
    const verifiedMap = (itemStorage.get('sas-verified-conversations') ?? {}) as Record<string, boolean>;
    const idToVerify = selectedMemberId ?? conversation.id;
    verifiedMap[idToVerify] = true;
    void itemStorage.put('sas-verified-conversations', verifiedMap);
    
    if (selectedMemberId) {
      // group modal verification after verifying a member
      setSelectedMemberId(null);
      setSelectedMemberName(null);
      setShowGroupSASModal(true);
    } else {
      // individual verification
      setSasVerified(true);
    }

    setSasNumber(null);
  }, [conversation.id, selectedMemberId]);

  const [showMismatchWarning, setShowMismatchWarning] = useState(false);

  const isTerminated = Boolean(conversation.terminated);
  const isMuted = isConversationMuted(conversation);

  if (hasPanelShowing) {
    return null;
  }

  return (
    <>
      {hasCustomDisappearingTimeoutModal && (
        <DisappearingTimeDialog
          i18n={i18n}
          initialValue={conversation.expireTimer}
          onSubmit={value => {
            setHasCustomDisappearingTimeoutModal(false);
            onConversationDisappearingMessagesChange(value);
          }}
          onClose={() => {
            setHasCustomDisappearingTimeoutModal(false);
          }}
        />
      )}
      {hasDeleteMessagesConfirmation && (
        <DeleteMessagesConfirmationDialog
          i18n={i18n}
          onDestroyMessages={() => {
            setHasDeleteMessagesConfirmation(false);
            onConversationDeleteMessages();
          }}
          onClose={() => {
            setHasDeleteMessagesConfirmation(false);
          }}
        />
      )}
      {hasLeaveGroupConfirmation && (
        <LeaveGroupConfirmationDialog
          i18n={i18n}
          cannotLeaveBecauseYouAreLastAdmin={cannotLeaveBecauseYouAreLastAdmin}
          onClose={() => {
            setHasLeaveGroupConfirmation(false);
          }}
          onLeaveGroup={() => {
            setHasLeaveGroupConfirmation(false);
            if (!cannotLeaveBecauseYouAreLastAdmin) {
              onConversationLeaveGroup();
            } else {
              setHasLeaveGroupConfirmation(false);
              setHasCannotLeaveGroupBecauseYouAreLastAdminAlert(true);
            }
          }}
        />
      )}
      {hasCannotLeaveGroupBecauseYouAreLastAdminAlert && (
        <CannotLeaveGroupBecauseYouAreLastAdminAlert
          i18n={i18n}
          onClose={() => {
            setHasCannotLeaveGroupBecauseYouAreLastAdminAlert(false);
          }}
        />
      )}

      <div
        className={tw(
          '@container flex flex-col shadow-elevation-1 shadow-no-outline'
        )}
      >
        {sasNumber != null && (
        <SASModal
          sasValue={sasNumber}
          onClose={() => setSasNumber(null)}
          onNumbersMatch={handleSASNumbersMatch}
          onNumbersMismatch={() => {
            setSasNumber(null);
            setShowMismatchWarning(true);
          }}
          contactName={selectedMemberName ?? conversation.title}
          i18n={i18n}
        />
      )}
      {showGroupSASModal && (
        <GroupSASModal
          conversationId={conversation.id}
          members={groupMembers}
          verifiedMap={(itemStorage.get('sas-verified-conversations') ?? {}) as Record<string, boolean>}
          onVerifyMember={handleVerifyMember}
          onClose={() => setShowGroupSASModal(false)}
          i18n={i18n}
        />
      )}
      {showMismatchWarning && (
        <MismatchWarningDialog
          i18n={i18n}
          onConfirm={() => {
            setShowMismatchWarning(false);
            setSasNumber(null);
            onConversationBlock();
          }}
          onCancel={() => {
            setShowMismatchWarning(false);
          }}
        />
      )}
        <AxoDragRegion.Root>
          <div className="module-ConversationHeader">
            <HeaderContent
              conversation={conversation}
              badge={badge ?? null}
              hasStories={hasStories ?? null}
              headerRef={headerRef}
              i18n={i18n}
              theme={theme}
              onViewUserStories={onViewUserStories}
              onViewConversationDetails={onViewConversationDetails}
              isSignalConversation={isSignalConversation ?? false}
              onShowSASModal={handleShowSASModal}
              sasVerified={sasVerified}
            />
            <div className={tw(`flex flex-row gap-1 px-4 @min-[500px]:gap-3`)}>
              {!isSmsOnlyOrUnregistered &&
                !isSignalConversation &&
                !isTerminated && (
                  <OutgoingCallButtons
                    conversation={conversation}
                    hasActiveCall={hasActiveCall}
                    i18n={i18n}
                    onOutgoingAudioCall={onOutgoingAudioCall}
                    onOutgoingVideoCall={onOutgoingVideoCall}
                    outgoingCallButtonStyle={outgoingCallButtonStyle}
                  />
                )}
              {isSignalConversation ? (
                <AxoIconButton.Root
                  symbol={isMuted ? 'bell-slash' : 'bell'}
                  size="md"
                  iconWeight={300}
                  variant="borderless-secondary"
                  onClick={() =>
                    onConversationMuteExpirationChange(
                      isMuted ? 0 : Number.MAX_SAFE_INTEGER
                    )
                  }
                  label={isMuted ? i18n('icu:unmute') : i18n('icu:mute')}
                />
              ) : null}
              <AxoIconButton.Root
                symbol="search"
                size="md"
                iconWeight={300}
                onClick={onSearchInConversation}
                label={i18n('icu:search')}
                variant="borderless-secondary"
              />

              <AxoDropdownMenu.Root>
                <AxoDropdownMenu.Trigger disabled={isSelectMode}>
                  <AxoIconButton.Root
                    size="md"
                    iconWeight={300}
                    onClick={onSearchInConversation}
                    symbol="more"
                    label={i18n('icu:moreInfo')}
                    variant="borderless-secondary"
                  />
                </AxoDropdownMenu.Trigger>
                <HeaderDropdownMenuContent
                  i18n={i18n}
                  conversation={conversation}
                  isTerminated={isTerminated}
                  isMissingMandatoryProfileSharing={
                    isMissingMandatoryProfileSharing ?? false
                  }
                  isSelectMode={isSelectMode}
                  isSignalConversation={isSignalConversation ?? false}
                  onChangeDisappearingMessages={
                    onConversationDisappearingMessagesChange
                  }
                  onChangeMuteExpiration={onConversationMuteExpirationChange}
                  onConversationAccept={onConversationAccept}
                  onConversationArchive={onConversationArchive}
                  onConversationBlock={() => {
                    setMessageRequestState(MessageRequestState.blocking);
                  }}
                  onConversationDelete={() => {
                    setMessageRequestState(MessageRequestState.deleting);
                  }}
                  onConversationDeleteMessages={() => {
                    setHasDeleteMessagesConfirmation(true);
                  }}
                  onConversationLeaveGroup={() => {
                    if (cannotLeaveBecauseYouAreLastAdmin) {
                      setHasCannotLeaveGroupBecauseYouAreLastAdminAlert(true);
                    } else {
                      setHasLeaveGroupConfirmation(true);
                    }
                  }}
                  onConversationMarkUnread={onConversationMarkUnread}
                  onConversationPin={onConversationPin}
                  onConversationReportAndMaybeBlock={() => {
                    setMessageRequestState(
                      MessageRequestState.reportingAndMaybeBlocking
                    );
                  }}
                  onConversationUnarchive={onConversationUnarchive}
                  onConversationUnblock={() => {
                    setMessageRequestState(MessageRequestState.unblocking);
                  }}
                  onConversationUnpin={onConversationUnpin}
                  onSelectModeEnter={onSelectModeEnter}
                  onSetupCustomDisappearingTimeout={() => {
                    setHasCustomDisappearingTimeoutModal(true);
                  }}
                  onShowMembers={onShowMembers}
                  onViewAllMedia={onViewAllMedia}
                  onViewConversationDetails={onViewConversationDetails}
                />
              </AxoDropdownMenu.Root>
            </div>
          </div>
        </AxoDragRegion.Root>

        <MessageRequestActionsConfirmation
          i18n={i18n}
          conversationId={conversation.id}
          conversationType={conversation.type}
          addedByName={addedByName}
          conversationName={conversationName}
          isBlocked={conversation.isBlocked ?? false}
          isReported={conversation.isReported ?? false}
          state={messageRequestState}
          acceptConversation={onConversationAccept}
          blockAndReportSpam={onConversationBlockAndReportSpam}
          blockConversation={onConversationBlock}
          reportSpam={onConversationReportSpam}
          deleteConversation={onConversationDelete}
          onChangeState={setMessageRequestState}
        />

        <ConversationSubheader
          i18n={i18n}
          contactSpoofingWarning={contactSpoofingWarning}
          conversationId={conversation.id}
          acknowledgeGroupMemberNameCollisions={
            acknowledgeGroupMemberNameCollisions
          }
          reviewConversationNameCollision={reviewConversationNameCollision}
          renderCollidingAvatars={renderCollidingAvatars}
          shouldShowMiniPlayer={shouldShowMiniPlayer}
          renderMiniPlayer={renderMiniPlayer}
          renderPinnedMessagesBar={renderPinnedMessagesBar}
        />
      </div>
    </>
  );
});

function HeaderContent({
  conversation,
  badge,
  hasStories,
  headerRef,
  i18n,
  theme,
  isSignalConversation,
  onViewUserStories,
  onViewConversationDetails,
  onShowSASModal,
  sasVerified,
}: {
  conversation: MinimalConversation;
  badge: BadgeType | null;
  hasStories: HasStories | null;
  headerRef: RefObject<HTMLDivElement | null>;
  i18n: LocalizerType;
  theme: ThemeType;
  isSignalConversation: boolean;
  onViewUserStories: () => void;
  onViewConversationDetails: () => void;
  onShowSASModal: () => void;
  sasVerified: boolean;
}) {
  let onClick: undefined | (() => void);
  const { type } = conversation;
  switch (type) {
    case 'direct':
      onClick = onViewConversationDetails;
      break;
    case 'group': {
      const hasGV2AdminEnabled = conversation.groupVersion === 2;
      onClick = hasGV2AdminEnabled ? onViewConversationDetails : undefined;
      break;
    }
    default:
      throw missingCaseError(type);
  }

  const [showSASButton, setShowSASButton] = useState(false);

  useEffect(() => {
    const value = itemStorage.get('sas-enabled');
    setShowSASButton(value === true);
  }, []);

  const avatar = (
    <span className="module-ConversationHeader__header__avatar">
      <Avatar
        avatarPlaceholderGradient={
          conversation.gradientStart && conversation.gradientEnd
            ? [conversation.gradientStart, conversation.gradientEnd]
            : undefined
        }
        avatarUrl={conversation.avatarUrl ?? undefined}
        badge={badge ?? undefined}
        color={conversation.color ?? undefined}
        conversationType={conversation.type}
        hasAvatar={conversation.hasAvatar}
        i18n={i18n}
        noteToSelf={conversation.isMe}
        onClick={hasStories ? onViewUserStories : onClick}
        phoneNumber={conversation.phoneNumber ?? undefined}
        profileName={conversation.profileName ?? undefined}
        size={AvatarSize.THIRTY_TWO}
        // user may have stories, but we don't show that on Note to Self conversation
        storyRing={conversation.isMe ? undefined : (hasStories ?? undefined)}
        theme={theme}
        title={conversation.title}
      />
    </span>
  );

  const isOfficialChat = isSignalConversation || conversation.isMe;

  const contents = (
    <div className="module-ConversationHeader__header__info">
      <HeaderInfoTitle
        name={conversation.name ?? null}
        title={conversation.title}
        type={conversation.type}
        i18n={i18n}
        isMe={conversation.isMe}
        isSignalConversation={isSignalConversation}
        headerRef={headerRef}
        showSAS={conversation.name ?? ''}
      />
      {(isOfficialChat ||
        conversation.expireTimer != null ||
        conversation.isVerified) && (
        <div className="module-ConversationHeader__header__info__subtitle">
          {isOfficialChat ? (
            <div>
              {i18n('icu:ConversationHero--signal-official-chat-title')}
            </div>
          ) : null}

          {conversation.expireTimer != null &&
            conversation.expireTimer !== 0 && (
              <div className="module-ConversationHeader__header__info__subtitle__expiration">
                {expirationTimer.format(i18n, conversation.expireTimer)}
              </div>
            )}

          {!isOfficialChat && conversation.isVerified && (
            <div className="module-ConversationHeader__header__info__subtitle__verified">
              {i18n('icu:verified')}
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (onClick) {
    return (
      <div className="module-ConversationHeader__header">
        {avatar}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <button
            type="button"
            className="module-ConversationHeader__header--clickable"
            onClick={onClick}
          >
            {contents}
          </button>

          {showSASButton && (
            conversation.type === 'group' ? (
              sasVerified ? (
                <span className="module-ConversationHeader__header__info__button">
                  ✓ All Members SAS Verified
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onShowSASModal}
                  className="module-ConversationHeader__header__info__button"
                >
                  Verify Group SAS
                </button>
              )
            ) : conversation.isBlocked ? (
              <span className="module-ConversationHeader__header__info__button" style={{ color: 'gray' }}>
                Blocked cannot verify SAS with this contact
              </span>
            ) : (
              sasVerified ? (
                <span className="module-ConversationHeader__header__info__button">
                  ✓ SAS Verified
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onShowSASModal}
                  className="module-ConversationHeader__header__info__button"
                >
                  View SAS Number
                </button>
              )
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="module-ConversationHeader__header" ref={headerRef}>
      {avatar}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <button
          type="button"
          className="module-ConversationHeader__header--clickable"
          onClick={onClick}
        >
          {contents}
        </button>

        {showSASButton && (
          sasVerified ? (
            <span className="module-ConversationHeader__header__info__button">
              ✓ SAS Verified
            </span>
          ) : (
            <button
              type="button"
              onClick={onShowSASModal}
              className="module-ConversationHeader__header__info__button"
            >
              View SAS Number
            </button>
          )
        )}
      </div>
    </div>
  );
}

function HeaderDropdownMenuContent({
  conversation,
  i18n,
  isMissingMandatoryProfileSharing,
  isSelectMode,
  isSignalConversation,
  isTerminated,
  onChangeDisappearingMessages,
  onChangeMuteExpiration,
  onConversationAccept,
  onConversationArchive,
  onConversationBlock,
  onConversationDelete,
  onConversationDeleteMessages,
  onConversationLeaveGroup,
  onConversationMarkUnread,
  onConversationPin,
  onConversationReportAndMaybeBlock,
  onConversationUnarchive,
  onConversationUnblock,
  onConversationUnpin,
  onSelectModeEnter,
  onSetupCustomDisappearingTimeout,
  onShowMembers,
  onViewAllMedia,
  onViewConversationDetails,
}: {
  conversation: MinimalConversation;
  i18n: LocalizerType;
  isMissingMandatoryProfileSharing: boolean;
  isSelectMode: boolean;
  isSignalConversation: boolean;
  isTerminated: boolean;
  onChangeDisappearingMessages: (seconds: DurationInSeconds) => void;
  onChangeMuteExpiration: (seconds: number) => void;
  onConversationAccept: () => void;
  onConversationArchive: () => void;
  onConversationBlock: () => void;
  onConversationDelete: () => void;
  onConversationDeleteMessages: () => void;
  onConversationLeaveGroup: () => void;
  onConversationMarkUnread: () => void;
  onConversationPin: () => void;
  onConversationReportAndMaybeBlock: () => void;
  onConversationUnarchive: () => void;
  onConversationUnblock: () => void;
  onConversationUnpin: () => void;
  onSelectModeEnter: () => void;
  onSetupCustomDisappearingTimeout: () => void;
  onShowMembers: () => void;
  onViewAllMedia: () => void;
  onViewConversationDetails: () => void;
}) {
  const muteOptions = getMuteOptions(conversation.muteExpiresAt, i18n);
  const isGroup = conversation.type === 'group';
  const disableTimerChanges =
    !conversation.canChangeTimer ||
    !conversation.acceptedMessageRequest ||
    conversation.left ||
    isMissingMandatoryProfileSharing;
  const hasGV2AdminEnabled = isGroup && conversation.groupVersion === 2;

  const disappearingMessagesValue = useMemo(() => {
    const { expireTimer } = conversation;
    if (expireTimer == null) {
      return '0';
    }

    if (expirationTimer.DEFAULT_DURATIONS_IN_SECONDS.includes(expireTimer)) {
      return `${expireTimer}`;
    }

    return 'custom';
  }, [conversation]);

  const onDisappearingMessagesValueChange = useCallback(
    (value: string) => {
      if (value === 'custom') {
        return;
      }

      const seconds = Number(value);
      strictAssert(Number.isFinite(seconds), 'Invalid value in radio item');
      onChangeDisappearingMessages(seconds as DurationInSeconds);
    },
    [onChangeDisappearingMessages]
  );

  if (isSelectMode) {
    return null;
  }

  const muteTitle = <span>{i18n('icu:muteNotificationsTitle')}</span>;
  const disappearingTitle = <span>{i18n('icu:disappearingMessages')}</span>;

  if (isSignalConversation) {
    return (
      <AxoDropdownMenu.Content>
        {conversation.isArchived ? (
          <AxoDropdownMenu.Item
            symbol="archive-up"
            onSelect={onConversationUnarchive}
          >
            {i18n('icu:moveConversationToInbox')}
          </AxoDropdownMenu.Item>
        ) : (
          <AxoDropdownMenu.Item
            symbol="archive"
            onSelect={onConversationArchive}
          >
            {i18n('icu:archiveConversation')}
          </AxoDropdownMenu.Item>
        )}
        <AxoDropdownMenu.Item
          symbol="trash"
          onSelect={onConversationDeleteMessages}
        >
          {i18n('icu:deleteConversation')}
        </AxoDropdownMenu.Item>
      </AxoDropdownMenu.Content>
    );
  }

  if (isGroup && conversation.groupVersion !== 2) {
    return (
      <AxoDropdownMenu.Content>
        <AxoDropdownMenu.Item symbol="group" onSelect={onShowMembers}>
          {i18n('icu:showMembers')}
        </AxoDropdownMenu.Item>
        <AxoDropdownMenu.Item symbol="album" onSelect={onViewAllMedia}>
          {i18n('icu:allMediaMenuItem')}
        </AxoDropdownMenu.Item>
        <AxoDropdownMenu.Separator />
        {conversation.isArchived ? (
          <AxoDropdownMenu.Item
            symbol="archive-up"
            onSelect={onConversationUnarchive}
          >
            {i18n('icu:moveConversationToInbox')}
          </AxoDropdownMenu.Item>
        ) : (
          <AxoDropdownMenu.Item
            symbol="archive"
            onSelect={onConversationArchive}
          >
            {i18n('icu:archiveConversation')}
          </AxoDropdownMenu.Item>
        )}
        <AxoDropdownMenu.Item
          symbol="trash"
          onSelect={onConversationDeleteMessages}
        >
          {i18n('icu:deleteConversation')}
        </AxoDropdownMenu.Item>
      </AxoDropdownMenu.Content>
    );
  }

  return (
    <AxoDropdownMenu.Content>
      {!conversation.acceptedMessageRequest && (
        <>
          {!conversation.isBlocked && (
            <AxoDropdownMenu.Item symbol="block" onSelect={onConversationBlock}>
              {i18n('icu:ConversationHeader__MenuItem--Block')}
            </AxoDropdownMenu.Item>
          )}
          {conversation.isBlocked && (
            <AxoDropdownMenu.Item
              symbol="message-thread"
              onSelect={onConversationUnblock}
            >
              {i18n('icu:ConversationHeader__MenuItem--Unblock')}
            </AxoDropdownMenu.Item>
          )}
          {!conversation.isBlocked && (
            <AxoDropdownMenu.Item
              symbol="message-thread"
              onSelect={onConversationAccept}
            >
              {i18n('icu:ConversationHeader__MenuItem--Accept')}
            </AxoDropdownMenu.Item>
          )}
          <AxoDropdownMenu.Item
            symbol="error-octagon"
            onSelect={onConversationReportAndMaybeBlock}
          >
            {i18n('icu:ConversationHeader__MenuItem--ReportSpam')}
          </AxoDropdownMenu.Item>
          <AxoDropdownMenu.Item symbol="trash" onSelect={onConversationDelete}>
            {i18n('icu:ConversationHeader__MenuItem--DeleteChat')}
          </AxoDropdownMenu.Item>
        </>
      )}
      {conversation.acceptedMessageRequest && (
        <>
          {disableTimerChanges ? null : (
            <AxoDropdownMenu.Sub>
              <AxoDropdownMenu.SubTrigger symbol="timer">
                <span data-testid="ConversationHeader__ContextMenu__DisappearingTimer">
                  {disappearingTitle}
                </span>
              </AxoDropdownMenu.SubTrigger>
              <AxoDropdownMenu.SubContent>
                <AxoDropdownMenu.RadioGroup
                  value={disappearingMessagesValue}
                  onValueChange={onDisappearingMessagesValueChange}
                >
                  {expirationTimer.DEFAULT_DURATIONS_IN_SECONDS.map(seconds => {
                    return (
                      <AxoDropdownMenu.RadioItem
                        key={seconds}
                        value={`${seconds}`}
                      >
                        {expirationTimer.format(i18n, seconds, {
                          capitalizeOff: true,
                        })}
                      </AxoDropdownMenu.RadioItem>
                    );
                  })}
                  <AxoDropdownMenu.RadioItem
                    value="custom"
                    onSelect={onSetupCustomDisappearingTimeout}
                  >
                    {i18n('icu:customDisappearingTimeOption')}
                  </AxoDropdownMenu.RadioItem>
                </AxoDropdownMenu.RadioGroup>
              </AxoDropdownMenu.SubContent>
            </AxoDropdownMenu.Sub>
          )}
          <AxoDropdownMenu.Sub>
            <AxoDropdownMenu.SubTrigger symbol="bell-slash">
              {muteTitle}
            </AxoDropdownMenu.SubTrigger>
            <AxoDropdownMenu.SubContent>
              {muteOptions.map(item => (
                <AxoDropdownMenu.Item
                  key={item.name}
                  disabled={item.disabled}
                  onSelect={() => {
                    onChangeMuteExpiration(item.value);
                  }}
                >
                  {item.name}
                </AxoDropdownMenu.Item>
              ))}
            </AxoDropdownMenu.SubContent>
          </AxoDropdownMenu.Sub>
          {!isGroup || hasGV2AdminEnabled ? (
            <AxoDropdownMenu.Item
              symbol="settings"
              onSelect={onViewConversationDetails}
            >
              {isGroup
                ? i18n('icu:showConversationDetails')
                : i18n('icu:showConversationDetails--direct')}
            </AxoDropdownMenu.Item>
          ) : null}
          <AxoDropdownMenu.Item symbol="album" onSelect={onViewAllMedia}>
            {i18n('icu:allMediaMenuItem')}
          </AxoDropdownMenu.Item>
          <AxoDropdownMenu.Separator />
          <AxoDropdownMenu.Item
            symbol="check-circle"
            onSelect={onSelectModeEnter}
          >
            {i18n('icu:ConversationHeader__menu__selectMessages')}
          </AxoDropdownMenu.Item>
          <AxoDropdownMenu.Separator />
          {!conversation.markedUnread ? (
            <AxoDropdownMenu.Item
              symbol="message-badge"
              onSelect={onConversationMarkUnread}
            >
              {i18n('icu:markUnread')}
            </AxoDropdownMenu.Item>
          ) : null}
          {conversation.isPinned ? (
            <AxoDropdownMenu.Item
              symbol="pin-slash"
              onSelect={onConversationUnpin}
            >
              {i18n('icu:unpinConversation')}
            </AxoDropdownMenu.Item>
          ) : (
            <AxoDropdownMenu.Item symbol="pin" onSelect={onConversationPin}>
              {i18n('icu:pinConversation')}
            </AxoDropdownMenu.Item>
          )}
          {conversation.isArchived ? (
            <AxoDropdownMenu.Item
              symbol="archive-up"
              onSelect={onConversationUnarchive}
            >
              {i18n('icu:moveConversationToInbox')}
            </AxoDropdownMenu.Item>
          ) : (
            <AxoDropdownMenu.Item
              symbol="archive"
              onSelect={onConversationArchive}
            >
              {i18n('icu:archiveConversation')}
            </AxoDropdownMenu.Item>
          )}
          {!conversation.isBlocked && !isTerminated && (
            <AxoDropdownMenu.Item symbol="block" onSelect={onConversationBlock}>
              {i18n('icu:ConversationHeader__MenuItem--Block')}
            </AxoDropdownMenu.Item>
          )}
          {conversation.isBlocked && !isTerminated && (
            <AxoDropdownMenu.Item
              symbol="message-thread"
              onSelect={onConversationUnblock}
            >
              {i18n('icu:ConversationHeader__MenuItem--Unblock')}
            </AxoDropdownMenu.Item>
          )}
          <AxoDropdownMenu.Item
            symbol="trash"
            onSelect={onConversationDeleteMessages}
          >
            {i18n('icu:deleteConversation')}
          </AxoDropdownMenu.Item>
          {isGroup && !isTerminated && (
            <AxoDropdownMenu.Item
              symbol="leave"
              onSelect={onConversationLeaveGroup}
            >
              {i18n(
                'icu:ConversationHeader__ContextMenu__LeaveGroupAction__title'
              )}
            </AxoDropdownMenu.Item>
          )}
        </>
      )}
    </AxoDropdownMenu.Content>
  );
}

function OutgoingCallButtons({
  conversation,
  hasActiveCall,
  i18n,
  onOutgoingAudioCall,
  onOutgoingVideoCall,
  outgoingCallButtonStyle,
}: Pick<
  PropsType,
  | 'i18n'
  | 'conversation'
  | 'hasActiveCall'
  | 'onOutgoingAudioCall'
  | 'onOutgoingVideoCall'
  | 'outgoingCallButtonStyle'
>): JSX.Element | null {
  const disabled =
    conversation.type === 'group' &&
    ((conversation.announcementsOnly && !conversation.areWeAdmin) ||
      conversation.terminated);
  const inAnotherCall = !disabled && hasActiveCall;

  const videoButton = (
    <div
      className={
        inAnotherCall || disabled ? tw('opacity-50 dark:opacity-40') : undefined
      }
    >
      <AxoIconButton.Root
        symbol="videocamera"
        iconWeight={300}
        size="md"
        onClick={onOutgoingVideoCall}
        label={i18n('icu:makeOutgoingVideoCall')}
        // A separate tooltip is shown if we are inAnotherCall
        tooltip={!inAnotherCall}
        variant="borderless-secondary"
      />
    </div>
  );
  const videoElement = inAnotherCall ? (
    <InAnotherCallTooltip i18n={i18n}>{videoButton}</InAnotherCallTooltip>
  ) : (
    videoButton
  );

  const startCallShortcuts = useStartCallShortcuts(
    onOutgoingAudioCall,
    onOutgoingVideoCall
  );
  useKeyboardShortcuts(startCallShortcuts);

  switch (outgoingCallButtonStyle) {
    case OutgoingCallButtonStyle.None:
      return null;
    case OutgoingCallButtonStyle.JustVideo:
      return videoElement;
    case OutgoingCallButtonStyle.Both:
      // oxlint-disable-next-line no-case-declarations
      const audioButton = (
        <div
          className={
            inAnotherCall ? tw('opacity-50 dark:opacity-40') : undefined
          }
        >
          <AxoIconButton.Root
            symbol="phone"
            iconWeight={300}
            size="md"
            onClick={onOutgoingAudioCall}
            label={i18n('icu:makeOutgoingCall')}
            // A separate tooltip is shown if we are inAnotherCall
            tooltip={!inAnotherCall}
            variant="borderless-secondary"
          />
        </div>
      );

      return (
        <>
          {videoElement}
          {inAnotherCall ? (
            <InAnotherCallTooltip i18n={i18n}>
              {audioButton}
            </InAnotherCallTooltip>
          ) : (
            audioButton
          )}
        </>
      );
    case OutgoingCallButtonStyle.Join:
      // oxlint-disable-next-line no-case-declarations
      const joinButton = (
        <>
          <div className={tw('@min-[500px]:hidden')}>
            <AxoIconButton.Root
              symbol="videocamera-fill"
              size="md"
              label={i18n('icu:joinOngoingCall')}
              onClick={onOutgoingVideoCall}
              variant="affirmative"
            />
          </div>
          <div className={tw('hidden @min-[500px]:block')}>
            <AxoButton.Root
              size="md"
              symbol="videocamera-fill"
              onClick={onOutgoingVideoCall}
              variant="affirmative"
            >
              {i18n('icu:joinOngoingCall')}
            </AxoButton.Root>
          </div>
        </>
      );
      return inAnotherCall ? (
        <InAnotherCallTooltip i18n={i18n}>{joinButton}</InAnotherCallTooltip>
      ) : (
        joinButton
      );
    default:
      throw missingCaseError(outgoingCallButtonStyle);
  }
}

function LeaveGroupConfirmationDialog({
  cannotLeaveBecauseYouAreLastAdmin,
  i18n,
  onLeaveGroup,
  onClose,
}: {
  cannotLeaveBecauseYouAreLastAdmin: boolean;
  i18n: LocalizerType;
  onLeaveGroup: () => void;
  onClose: () => void;
}) {
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={onClose}
      title={i18n('icu:ConversationHeader__LeaveGroupConfirmation__title')}
      description={i18n(
        'icu:ConversationHeader__LeaveGroupConfirmation__description'
      )}
    >
      <AxoConfirmDialog.Cancel />
      <AxoConfirmDialog.Action
        variant="destructive"
        onClick={onLeaveGroup}
        disabled={cannotLeaveBecauseYouAreLastAdmin}
      >
        {i18n('icu:ConversationHeader__LeaveGroupConfirmation__confirmButton')}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}

/** @testexport */
export function CannotLeaveGroupBecauseYouAreLastAdminAlert(props: {
  i18n: LocalizerType;
  onClose: () => void;
}): ReactNode {
  const { i18n } = props;
  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={props.onClose}
      // @ts-expect-error ConfirmationDialog migration: Needs title
      title={null}
      description={i18n(
        'icu:ConversationHeader__CannotLeaveGroupBecauseYouAreLastAdminAlert__description'
      )}
    >
      <AxoConfirmDialog.Cancel>{i18n('icu:ok')}</AxoConfirmDialog.Cancel>
    </AxoConfirmDialog.Root>
  );
}

function ConversationSubheader(props: {
  i18n: LocalizerType;

  conversationId: string;

  contactSpoofingWarning: ContactSpoofingWarning | null;
  reviewConversationNameCollision: ReviewConversationNameCollission;
  acknowledgeGroupMemberNameCollisions: AcknowledgeGroupMemberNameCollisions;
  renderCollidingAvatars: RenderCollidingAvatars;

  shouldShowMiniPlayer: boolean;
  renderMiniPlayer: RenderMiniPlayer;
  renderPinnedMessagesBar: RenderPinnedMessagesBar;
}) {
  const { i18n } = props;
  const [
    hasDismissedDirectContactSpoofingWarning,
    setHasDismissedDirectContactSpoofingWarning,
  ] = useState(false);

  const renderableContactSpoofingWarning = getRenderableContactSpoofingWarning(
    props.contactSpoofingWarning,
    hasDismissedDirectContactSpoofingWarning
  );

  const handleDismissDirectContactSpoofingWarning = useCallback(() => {
    setHasDismissedDirectContactSpoofingWarning(true);
  }, []);

  return (
    <>
      {renderableContactSpoofingWarning != null && (
        <>
          {renderableContactSpoofingWarning.type ===
            ContactSpoofingType.DirectConversationWithSameTitle && (
            <DirectConversationWithSameTitleWarning
              i18n={i18n}
              reviewConversationNameCollision={
                props.reviewConversationNameCollision
              }
              onDismissDirectContactSpoofingWarning={
                handleDismissDirectContactSpoofingWarning
              }
            />
          )}
          {renderableContactSpoofingWarning.type ===
            ContactSpoofingType.MultipleGroupMembersWithSameTitle && (
            <MultipleGroupMembersWithSameTitleWarning
              i18n={i18n}
              conversationId={props.conversationId}
              contactSpoofingWarning={renderableContactSpoofingWarning}
              acknowledgeGroupMemberNameCollisions={
                props.acknowledgeGroupMemberNameCollisions
              }
              reviewConversationNameCollision={
                props.reviewConversationNameCollision
              }
              renderCollidingAvatars={props.renderCollidingAvatars}
            />
          )}
        </>
      )}
      {props.shouldShowMiniPlayer &&
        props.renderMiniPlayer({ shouldFlow: true })}
      {!props.shouldShowMiniPlayer && props.renderPinnedMessagesBar()}
    </>
  );
}

function getRenderableContactSpoofingWarning(
  contactSpoofingWarning: ContactSpoofingWarning | null,
  hasDismissedDirectContactSpoofingWarning: boolean
): ContactSpoofingWarning | null {
  if (contactSpoofingWarning == null) {
    return null;
  }

  if (
    contactSpoofingWarning.type ===
    ContactSpoofingType.DirectConversationWithSameTitle
  ) {
    const shouldRender = !hasDismissedDirectContactSpoofingWarning;
    return shouldRender ? contactSpoofingWarning : null;
  }

  if (
    contactSpoofingWarning.type ===
    ContactSpoofingType.MultipleGroupMembersWithSameTitle
  ) {
    const shouldRender = hasUnacknowledgedCollisions(
      contactSpoofingWarning.acknowledgedGroupNameCollisions,
      contactSpoofingWarning.groupNameCollisions
    );

    return shouldRender ? contactSpoofingWarning : null;
  }

  throw missingCaseError(contactSpoofingWarning);
}

function DirectConversationWithSameTitleWarning(props: {
  i18n: LocalizerType;
  reviewConversationNameCollision: ReviewConversationNameCollission;
  onDismissDirectContactSpoofingWarning: () => void;
}) {
  const { i18n } = props;

  return (
    <TimelineWarning
      i18n={i18n}
      onClose={props.onDismissDirectContactSpoofingWarning}
    >
      <I18n
        i18n={i18n}
        id="icu:ContactSpoofing__same-name--link"
        components={{
          reviewRequestLink: parts => (
            <TimelineWarningLink
              onClick={props.reviewConversationNameCollision}
            >
              {parts}
            </TimelineWarningLink>
          ),
        }}
      />
    </TimelineWarning>
  );
}

function MultipleGroupMembersWithSameTitleWarning(props: {
  i18n: LocalizerType;
  conversationId: string;
  contactSpoofingWarning: MultipleGroupMembersWithSameTitleContactSpoofingWarning;
  acknowledgeGroupMemberNameCollisions: AcknowledgeGroupMemberNameCollisions;
  reviewConversationNameCollision: ReviewConversationNameCollission;
  renderCollidingAvatars: RenderCollidingAvatars;
}) {
  const {
    i18n,
    conversationId,
    contactSpoofingWarning,
    acknowledgeGroupMemberNameCollisions,
    reviewConversationNameCollision,
    renderCollidingAvatars,
  } = props;
  const { groupNameCollisions } = contactSpoofingWarning;

  const numberOfSharedNames = Object.keys(groupNameCollisions).length;
  const conversationIds = Object.values(groupNameCollisions).flat(1);

  const handleClose = useCallback(() => {
    acknowledgeGroupMemberNameCollisions(conversationId, groupNameCollisions);
  }, [
    acknowledgeGroupMemberNameCollisions,
    conversationId,
    groupNameCollisions,
  ]);

  const reviewRequestLink = useCallback(
    (parts: I18nComponentParts) => {
      return (
        <TimelineWarningLink onClick={reviewConversationNameCollision}>
          {parts}
        </TimelineWarningLink>
      );
    },
    [reviewConversationNameCollision]
  );

  if (numberOfSharedNames === 1) {
    return (
      <TimelineWarning
        i18n={i18n}
        onClose={handleClose}
        customInfo={
          conversationIds.length >= 2 ? (
            <TimelineWarningCustomInfo>
              {renderCollidingAvatars({ conversationIds })}
            </TimelineWarningCustomInfo>
          ) : null
        }
      >
        <I18n
          i18n={i18n}
          id="icu:ContactSpoofing__same-name-in-group--link"
          components={{
            count: conversationIds.length,
            reviewRequestLink,
          }}
        />
      </TimelineWarning>
    );
  }

  return (
    <TimelineWarning i18n={i18n} onClose={handleClose}>
      <I18n
        i18n={i18n}
        id="icu:ContactSpoofing__same-names-in-group--link"
        components={{
          count: numberOfSharedNames,
          reviewRequestLink,
        }}
      />
    </TimelineWarning>
  );
}

// right now this is displaying safety number and not the SAS flow
function SASModal({
  sasValue,
  onClose,
  onNumbersMatch,
  onNumbersMismatch,
  contactName,
  i18n,
}: {
  sasValue: string;
  onClose: () => void;
  onNumbersMatch: () => void;
  onNumbersMismatch: () => void;
  contactName: string;
  i18n: LocalizerType;
}) {
  return (
    <ConfirmationDialog
      dialogName="ConversationHeader.SASModal"
      title="SAS Number"
      i18n={i18n}
      onClose={onClose}
      cancelText='Close'
      actions={[
        {
          text: 'Numbers Match',
          action: onNumbersMatch,
          style: 'affirmative',
        },
        {
          text: 'Numbers Mismatch',
          action: onNumbersMismatch,
          style: 'negative',
        }
      ]}
    >
      <div className="module-ConversationHeader__SASModal__content">
        <p>Verify your SAS with {contactName}: </p>
        <code className="module-ConversationHeader__SASModal__sasValue">
          {sasValue} 
        </code>
      </div>
    </ConfirmationDialog>
  )
}

function GroupSASModal ({
  members,
  verifiedMap,
  onVerifyMember,
  onClose,
  i18n,
}: {
  conversationId: string;
  members: Array<{ id: string; name: string; isBlocked: boolean }>;
  verifiedMap: Record<string, boolean>;
  onVerifyMember: (memberId: string) => void;
  onClose: () => void;
  i18n: LocalizerType;
}) {
  const allVerified = members
    .filter(m => !m.isBlocked)
    .every(m => verifiedMap[m.id] === true);

  return (
    <ConfirmationDialog
      dialogName="ConversationHeader.GroupSASModal"
      title="Group SAS Verification"
      i18n={i18n}
      onClose={onClose}
      cancelText='Close'
      actions={[]}
    >
      <p>
        {allVerified
          ? '✓ All members verified'
          : 'Verify SAS with each member:'}
      </p>
      {members.map(member => (
        <div key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span>{member.name}</span>
          {member.isBlocked ? (
            <span style={{ color: 'gray' }}>Blocked</span>
          ) : verifiedMap[member.id] ? (
            <span style={{ color: 'green' }}>✓ Verified</span>
          ) : (
            <button
              type='button'
              onClick={() => onVerifyMember(member.id)}
            >
              Verify
            </button>
          )}
        </div>
      ))}
    </ConfirmationDialog>
  )
}

function MismatchWarningDialog ({
  i18n,
  onConfirm,
  onCancel,
}: {
  i18n: LocalizerType;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmationDialog
      dialogName='ConversationHeader.MismatchWarning'
      title='⚠️ Possible Security Risk'
      i18n={i18n}
      onClose={onCancel}
      cancelText='Go Back'
      actions={[
        {
          text: 'Yes, Block This Contact',
          action: onConfirm,
          style: 'negative',
        }
      ]}
    >
      <p>
        If the numbers do not match, someone may be intercepting your messages.
        Are you sure you want to block this contact?
      </p>
      <p>
        This action will prevent you from sending or receiving messages from this person.
      </p>
    </ConfirmationDialog>
  )
}