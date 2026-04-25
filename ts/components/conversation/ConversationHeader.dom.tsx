// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import type { RefObject } from 'react';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReadonlyDeep } from 'type-fest';
import type { BadgeType } from '../../badges/types.std.js';
import {
  useKeyboardShortcuts,
  useStartCallShortcuts,
} from '../../hooks/useKeyboardShortcuts.dom.js';
import { SizeObserver } from '../../hooks/useSizeObserver.dom.js';
import type { ConversationTypeType } from '../../state/ducks/conversations.preload.js';
import type { HasStories } from '../../types/Stories.std.js';
import type { LocalizerType, ThemeType } from '../../types/Util.std.js';
import type { DurationInSeconds } from '../../util/durations/index.std.js';
import * as expirationTimer from '../../util/expirationTimer.std.js';
import { getMuteOptions } from '../../util/getMuteOptions.std.js';
import { isConversationMuted } from '../../util/isConversationMuted.std.js';
import { isInSystemContacts } from '../../util/isInSystemContacts.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { Alert } from '../Alert.dom.js';
import { Avatar, AvatarSize } from '../Avatar.dom.js';
import { ConfirmationDialog } from '../ConfirmationDialog.dom.js';
import { DisappearingTimeDialog } from '../DisappearingTimeDialog.dom.js';
import { InContactsIcon } from '../InContactsIcon.dom.js';
import { UserText } from '../UserText.dom.js';
import type { ContactNameData } from './ContactName.dom.js';
import {
  MessageRequestActionsConfirmation,
  MessageRequestState,
} from './MessageRequestActionsConfirmation.dom.js';
import type { MinimalConversation } from '../../hooks/useMinimalConversation.std.js';
import { InAnotherCallTooltip } from './InAnotherCallTooltip.dom.js';
import { DeleteMessagesConfirmationDialog } from '../DeleteMessagesConfirmationDialog.dom.js';
import { AxoDropdownMenu } from '../../axo/AxoDropdownMenu.dom.js';
import { strictAssert } from '../../util/assert.std.js';
import {
  TimelineWarning,
  TimelineWarningCustomInfo,
  TimelineWarningLink,
} from './TimelineWarning.dom.js';
import { ContactSpoofingType } from '../../util/contactSpoofing.std.js';
import type { GroupNameCollisionsWithIdsByTitle } from '../../util/groupMemberNameCollisions.std.js';
import { hasUnacknowledgedCollisions } from '../../util/groupMemberNameCollisions.std.js';
import type { I18nComponentParts } from '../I18n.dom.js';
import { I18n } from '../I18n.dom.js';
import type { SmartCollidingAvatarsProps } from '../../state/smart/CollidingAvatars.dom.js';
import type {
  ContactSpoofingWarning,
  MultipleGroupMembersWithSameTitleContactSpoofingWarning,
} from '../../state/selectors/timeline.preload.js';
import { tw } from '../../axo/tw.dom.js';
import { generateSafetyNumber } from '../../util/safetyNumber.preload.js';
import { itemStorage } from '../../textsecure/Storage.preload.js';
import { signalProtocolStore } from '../../SignalProtocolStore.preload.js';

// Test SAS setting toggle
export function isSASEnabled(): boolean {
  return itemStorage.get('sas-enabled', true);
}

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
  headerRef: React.RefObject<HTMLDivElement>;
}) {
  if (isSignalConversation) {
    return (
      <div className="module-ConversationHeader__header__info__title">
        <UserText text={title} />
        <span className="ContactModal__official-badge" />
      </div>
    );
  }

  if (isMe) {
    return (
      <div className="module-ConversationHeader__header__info__title">
        {i18n('icu:noteToSelf')}
        <span className="ContactModal__official-badge" />
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
) => React.JSX.Element;

export type RenderMiniPlayer = (options: {
  shouldFlow: boolean;
}) => React.JSX.Element;
export type RenderPinnedMessagesBar = () => React.JSX.Element;

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
  localDeleteWarningShown: boolean;
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
  setLocalDeleteWarningShown: () => void;

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
  localDeleteWarningShown,
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
  setLocalDeleteWarningShown,
  theme,

  contactSpoofingWarning,
  acknowledgeGroupMemberNameCollisions,
  reviewConversationNameCollision,
  renderCollidingAvatars,

  shouldShowMiniPlayer,
  renderMiniPlayer,

  renderPinnedMessagesBar,
}: PropsType): React.JSX.Element | null {
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
  const [isNarrow, setIsNarrow] = useState(false);
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
      const memberConv = window.ConversationController.get(memberId);
      const resolvedId = memberConv?.id ?? memberId;

      const fullConversation = memberConv?.format();
      if (!fullConversation?.serviceId) {
        console.error('Member conversation has no serviceId');
        return;
      }

      const result = await generateSafetyNumber(fullConversation);
      setSelectedMemberId(resolvedId);
      const memberName = groupMembers.find(m => m.id === memberId)?.name ?? 'Unknown';
      setSelectedMemberName(memberName);
      const total = result.numberBlocks.reduce((sum, block) => sum + parseInt(block, 10), 0) % 1000000;
      setSasNumber(total.toString().padStart(6, '0'));
      setShowGroupSASModal(false);
    } catch (err) {
      console.error('Failed to generate safety number', err);
    }
  }, []);

  const [groupMembersVersion, setGroupMembersVersion] = useState(0);
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
            id: memberConv?.id ?? id,
            name: memberConv?.get('profileName') ?? memberConv?.get('name') ?? memberConv?.get('e164') ?? id ?? 'Unknown',
            isBlocked: memberConv?.isBlocked() === true,
          }
        })
      
    } catch (err) {
      console.error('Failed to get group members', err);
      return [];
    }
  }, [conversation.id, conversation.type, groupMembersVersion]);

  const [sasVerified, setSasVerified] = useState(false);
  useEffect(() => {
    try {
      const verifiedMap = (itemStorage.get('sas-verified-conversations') ?? {}) as Record<string, boolean>;
      if (conversation.type === 'group') {
        const allVerified = groupMembers.length > 0 && groupMembers.every(m => {
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
  }, [conversation.id, conversation.type, groupMembers]);

  const handleSASNumbersMatch = useCallback(() => {
    const verifiedMap = (itemStorage.get('sas-verified-conversations') ?? {}) as Record<string, boolean>;
    const idToVerify = selectedMemberId ?? conversation.id;
    const updatedMap = {...verifiedMap, [idToVerify]: true };
    void itemStorage.put('sas-verified-conversations', updatedMap);

    if (selectedMemberId) {
      // group modal verification after verifying a member
      setSelectedMemberId(null);
      setSelectedMemberName(null);
      setShowGroupSASModal(true);

      // update right away to reflect the changes instead of doing it later
      const allVerified = groupMembers.length > 0 && groupMembers.every(m => updatedMap[m.id] === true);
      setSasVerified(allVerified);
    } else {
      // individual verification
      setSasVerified(true);
    }

    setSasNumber(null);
  }, [conversation.id, selectedMemberId, groupMembers]);

  const [showMismatchWarning, setShowMismatchWarning] = useState(false);
  const [mismatchMemberId, setMismatchMemberId] = useState<string | null>(null);

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
          localDeleteWarningShown={localDeleteWarningShown}
          onDestroyMessages={() => {
            setHasDeleteMessagesConfirmation(false);
            onConversationDeleteMessages();
          }}
          onClose={() => {
            setHasDeleteMessagesConfirmation(false);
          }}
          setLocalDeleteWarningShown={setLocalDeleteWarningShown}
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
      {sasNumber != null && (
        <SASModal
          sasValue={sasNumber}
          onClose={() => setSasNumber(null)}
          onNumbersMatch={handleSASNumbersMatch}
          onNumbersMismatch={() => {
            setSasNumber(null);
            setMismatchMemberId(selectedMemberId); // capturing the mismatched member id for group
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
          isGroupMember={mismatchMemberId != null}
          onConfirm={() => {
            setShowMismatchWarning(false);
            setSasNumber(null);

            if (mismatchMemberId) {
              const memberConv = window.ConversationController.get(mismatchMemberId);
              memberConv?.block();
              setGroupMembersVersion(v => v + 1); // refresh group members to reflect the update blocked status
              setMismatchMemberId(null); 
              setSelectedMemberId(null);
              setSelectedMemberName(null);
              setShowGroupSASModal(true);
            } else {
              onConversationBlock();
            }
          }}
          onCancel={() => {
            setShowMismatchWarning(false);
            setMismatchMemberId(null);
            // cancelling during group flow, go back to group modal
            if (selectedMemberId) {
              setShowGroupSASModal(true);
            }
          }}
        />
      )}

      <SizeObserver
        onSizeChange={size => {
          setIsNarrow(size.width < 500);
        }}
      >
        {measureRef => (
          <div
            className={tw('flex flex-col shadow-elevation-1 shadow-no-outline')}
            ref={measureRef}
          >
            <div
              className={classNames('module-ConversationHeader', {
                'module-ConversationHeader--narrow': isNarrow,
              })}
            >
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

              {!isSmsOnlyOrUnregistered && !isSignalConversation && (
                <OutgoingCallButtons
                  conversation={conversation}
                  hasActiveCall={hasActiveCall}
                  i18n={i18n}
                  isNarrow={isNarrow}
                  onOutgoingAudioCall={onOutgoingAudioCall}
                  onOutgoingVideoCall={onOutgoingVideoCall}
                  outgoingCallButtonStyle={outgoingCallButtonStyle}
                />
              )}
              <button
                type="button"
                onClick={onSearchInConversation}
                className={classNames(
                  'module-ConversationHeader__button',
                  'module-ConversationHeader__button--search'
                )}
                aria-label={i18n('icu:search')}
              />

              <AxoDropdownMenu.Root>
                <AxoDropdownMenu.Trigger disabled={isSelectMode}>
                  <button
                    type="button"
                    className={classNames(
                      'module-ConversationHeader__button',
                      'module-ConversationHeader__button--more'
                    )}
                    aria-label={i18n('icu:moreInfo')}
                  />
                </AxoDropdownMenu.Trigger>
                <HeaderDropdownMenuContent
                  i18n={i18n}
                  conversation={conversation}
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
        )}
      </SizeObserver>
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
  headerRef: RefObject<HTMLDivElement>;
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

 const showSASButton = itemStorage.get('sas-enabled', true);

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
      />
      {(conversation.expireTimer != null || conversation.isVerified) && (
        <div className="module-ConversationHeader__header__info__subtitle">
          {conversation.expireTimer != null &&
            conversation.expireTimer !== 0 && (
              <div className="module-ConversationHeader__header__info__subtitle__expiration">
                {expirationTimer.format(i18n, conversation.expireTimer)}
              </div>
            )}
          {conversation.isVerified && (
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
              sasVerified ? (
                <span className="module-ConversationHeader__header__info__button" style={{ color: 'gray' }}>
                  ✓ SAS Verified but Contact is Blocked
                </span>
              ) : (
                <span className="module-ConversationHeader__header__info__button" style={{ color: 'gray' }}>
                  Not possible to verify SAS with a blocked contact
                </span>
              )
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
  const disableTimerChanges = Boolean(
    !conversation.canChangeTimer ||
    !conversation.acceptedMessageRequest ||
    conversation.left ||
    isMissingMandatoryProfileSharing
  );
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
    const isMuted =
      conversation.muteExpiresAt && isConversationMuted(conversation);

    return (
      <AxoDropdownMenu.Content>
        <AxoDropdownMenu.Sub>
          <AxoDropdownMenu.SubTrigger symbol="bell-slash">
            {muteTitle}
          </AxoDropdownMenu.SubTrigger>
          <AxoDropdownMenu.SubContent>
            {isMuted ? (
              <AxoDropdownMenu.Item
                onSelect={() => {
                  onChangeMuteExpiration(0);
                }}
              >
                {i18n('icu:unmute')}
              </AxoDropdownMenu.Item>
            ) : (
              <AxoDropdownMenu.Item
                onSelect={() => {
                  onChangeMuteExpiration(Number.MAX_SAFE_INTEGER);
                }}
              >
                {i18n('icu:muteAlways')}
              </AxoDropdownMenu.Item>
            )}
          </AxoDropdownMenu.SubContent>
        </AxoDropdownMenu.Sub>
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
          <AxoDropdownMenu.Item
            symbol="trash"
            onSelect={onConversationDeleteMessages}
          >
            {i18n('icu:deleteConversation')}
          </AxoDropdownMenu.Item>
          {isGroup && (
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
  isNarrow,
  onOutgoingAudioCall,
  onOutgoingVideoCall,
  outgoingCallButtonStyle,
}: { isNarrow: boolean } & Pick<
  PropsType,
  | 'i18n'
  | 'conversation'
  | 'hasActiveCall'
  | 'onOutgoingAudioCall'
  | 'onOutgoingVideoCall'
  | 'outgoingCallButtonStyle'
>): React.JSX.Element | null {
  const disabled =
    conversation.type === 'group' &&
    conversation.announcementsOnly &&
    !conversation.areWeAdmin;
  const inAnotherCall = !disabled && hasActiveCall;

  const videoButton = (
    <button
      aria-label={i18n('icu:makeOutgoingVideoCall')}
      className={classNames(
        'module-ConversationHeader__button',
        'module-ConversationHeader__button--video',
        disabled
          ? 'module-ConversationHeader__button--show-disabled'
          : undefined,
        inAnotherCall
          ? 'module-ConversationHeader__button--in-another-call'
          : undefined
      )}
      onClick={onOutgoingVideoCall}
      type="button"
    />
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
      // eslint-disable-next-line no-case-declarations
      const audioButton = (
        <button
          type="button"
          onClick={onOutgoingAudioCall}
          className={classNames(
            'module-ConversationHeader__button',
            'module-ConversationHeader__button--audio',
            inAnotherCall
              ? 'module-ConversationHeader__button--in-another-call'
              : undefined
          )}
          aria-label={i18n('icu:makeOutgoingCall')}
        />
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
      // eslint-disable-next-line no-case-declarations
      const joinButton = (
        <button
          aria-label={i18n('icu:joinOngoingCall')}
          className={classNames(
            'module-ConversationHeader__button',
            'module-ConversationHeader__button--join-call',
            disabled
              ? 'module-ConversationHeader__button--show-disabled'
              : undefined,
            inAnotherCall
              ? 'module-ConversationHeader__button--in-another-call'
              : undefined
          )}
          onClick={onOutgoingVideoCall}
          type="button"
        >
          {isNarrow ? null : i18n('icu:joinOngoingCall')}
        </button>
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
    <ConfirmationDialog
      dialogName="ConversationHeader.leaveGroup"
      title={i18n('icu:ConversationHeader__LeaveGroupConfirmation__title')}
      actions={[
        {
          disabled: cannotLeaveBecauseYouAreLastAdmin,
          action: onLeaveGroup,
          style: 'negative',
          text: i18n(
            'icu:ConversationHeader__LeaveGroupConfirmation__confirmButton'
          ),
        },
      ]}
      i18n={i18n}
      onClose={onClose}
    >
      {i18n('icu:ConversationHeader__LeaveGroupConfirmation__description')}
    </ConfirmationDialog>
  );
}

function CannotLeaveGroupBecauseYouAreLastAdminAlert({
  i18n,
  onClose,
}: {
  i18n: LocalizerType;
  onClose: () => void;
}) {
  return (
    <Alert
      i18n={i18n}
      body={i18n(
        'icu:ConversationHeader__CannotLeaveGroupBecauseYouAreLastAdminAlert__description'
      )}
      onClose={onClose}
    />
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
          // This is a render props, not a component
          // eslint-disable-next-line react/no-unstable-nested-components
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
        <div style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#1b1b1b',
          borderRadius: '12px',
          padding: '16px 24px',
          marginTop: '12px',
        }}>
          {sasValue.replace(/\s/g, '').split('').map((digit, index) => (
            <span 
              key={index}
              style={{
                fontSize: '32px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                width: '36px',
                textAlign: 'center',
                lineHeight: '1',
              }}
              >
                {digit}
              </span>
          ))}
        </div>
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
  const allVerified = members.length > 0 && members.every(m => verifiedMap[m.id] === true);

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
  isGroupMember = false,
}: {
  i18n: LocalizerType;
  onConfirm: () => void;
  onCancel: () => void;
  isGroupMember?: boolean;
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
          text: isGroupMember ? 'Yes, Block This Member' : 'Yes, Block This Contact',
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