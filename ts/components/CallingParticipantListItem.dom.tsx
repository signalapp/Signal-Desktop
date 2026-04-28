// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';
import classNames from 'classnames';

import { tw } from '../axo/tw.dom.tsx';
import { Avatar, AvatarSize } from './Avatar.dom.tsx';
import { ContactName } from './conversation/ContactName.dom.tsx';
import { InContactsIcon } from './InContactsIcon.dom.tsx';
import type { LocalizerType } from '../types/Util.std.ts';
import type { ServiceIdString } from '../types/ServiceId.std.ts';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import { isInSystemContacts } from '../util/isInSystemContacts.std.ts';
import type { ContactModalStateType } from '../types/globalModals.std.ts';
import { AxoIconButton } from '../axo/AxoIconButton.dom.tsx';
import type { PropsType as SmartCallingParticipantMenuProps } from '../state/smart/CallingParticipantMenu.preload.tsx';

export type ParticipantType = ConversationType & {
  demuxId?: number;
  hasRemoteAudio?: boolean;
  hasRemoteVideo?: boolean;
  isHandRaised?: boolean;
  presenting?: boolean;
};

type PropsType = {
  readonly callConversationId: string | undefined;
  readonly i18n: LocalizerType;
  readonly ourServiceId: ServiceIdString | undefined;
  readonly participant: ParticipantType;
  readonly participantMenuDisabled: boolean | undefined;
  readonly showContactModal: (payload: ContactModalStateType) => void;
  readonly renderCallingParticipantMenu: (
    props: SmartCallingParticipantMenuProps
  ) => React.JSX.Element;
};

export function CallingParticipantListItem({
  callConversationId,
  i18n,
  ourServiceId,
  participant,
  participantMenuDisabled,
  renderCallingParticipantMenu,
  showContactModal,
}: PropsType): React.JSX.Element {
  const {
    demuxId,
    hasRemoteAudio,
    id: participantConversationId,
    isMe,
  } = participant;

  const renderParticipantContextMenu = useCallback(() => {
    const children = (
      <AxoIconButton.Root
        variant="borderless-secondary"
        size="sm"
        symbol="more"
        label={i18n('icu:CallingParticipantListItem__ContextMenuButton')}
        tooltip={false}
      />
    );
    return renderCallingParticipantMenu({
      callConversationId,
      participantConversationId,
      demuxId,
      hasAudio: Boolean(hasRemoteAudio),
      align: 'end',
      side: 'bottom',
      renderer: 'AxoDropdownMenu',
      children,
    });
  }, [
    callConversationId,
    demuxId,
    hasRemoteAudio,
    i18n,
    participantConversationId,
    renderCallingParticipantMenu,
  ]);

  const handleClick = useCallback(() => {
    if (!participantMenuDisabled || isMe) {
      return;
    }

    showContactModal({
      activeCallDemuxId: participant.demuxId,
      contactId: participant.id,
      conversationId: callConversationId,
    });
  }, [
    callConversationId,
    isMe,
    participant.demuxId,
    participant.id,
    participantMenuDisabled,
    showContactModal,
  ]);

  return (
    <div
      className={classNames(
        'module-calling-participants-list__contact',
        isMe && 'module-calling-participants-list__me',
        participantMenuDisabled && 'module-calling-participants-list__clickable'
      )}
      onClick={handleClick}
      onKeyDown={handleClick}
      role="button"
    >
      <div className="module-calling-participants-list__avatar-and-name">
        <Avatar
          avatarPlaceholderGradient={participant.avatarPlaceholderGradient}
          avatarUrl={participant.avatarUrl}
          badge={undefined}
          color={participant.color}
          conversationType="direct"
          i18n={i18n}
          profileName={participant.profileName}
          title={participant.title}
          size={AvatarSize.THIRTY_SIX}
        />
        {ourServiceId && participant.serviceId === ourServiceId ? (
          <span className="module-calling-participants-list__name">
            {i18n('icu:you')}
          </span>
        ) : (
          <div className={tw('min-w-0')}>
            <div className={tw('min-w-0 truncate')}>
              <ContactName
                module="module-calling-participants-list__name"
                title={participant.title}
              />
              {isInSystemContacts(participant) ? (
                <span>
                  {' '}
                  <InContactsIcon
                    className="module-calling-participants-list__contact-icon"
                    i18n={i18n}
                  />
                </span>
              ) : null}
            </div>
            {participant.presenting && (
              <div
                className={tw(
                  'flex flex-row items-center type-caption text-label-secondary scheme-dark'
                )}
              >
                <span
                  className={classNames(
                    'module-calling-participants-list__status-icon',
                    'module-calling-participants-list__presenting'
                  )}
                />
                <span className={tw('-ms-1')}>
                  {i18n('icu:CallingParticipantListItem__Presenting')}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      <span
        className={classNames(
          'module-calling-participants-list__status-icon',
          !hasRemoteAudio && 'module-calling-participants-list__muted--audio'
        )}
      />
      {!participantMenuDisabled && renderParticipantContextMenu()}
    </div>
  );
}
