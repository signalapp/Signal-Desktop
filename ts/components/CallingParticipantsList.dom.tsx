// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import type { ServiceIdString } from '../types/ServiceId.std.ts';
import { sortByTitle } from '../util/sortByTitle.std.ts';
import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import { ModalHost } from './ModalHost.dom.tsx';
import type { ContactModalStateType } from '../types/globalModals.std.ts';
import { CallingParticipantListItem } from './CallingParticipantListItem.dom.tsx';
import type { PropsType as SmartCallingParticipantMenuProps } from '../state/smart/CallingParticipantMenu.preload.tsx';

export type CallingParticipantType = ConversationType & {
  demuxId?: number;
  hasRemoteAudio?: boolean;
  hasRemoteVideo?: boolean;
  isHandRaised?: boolean;
  presenting?: boolean;
};

export type PropsType = {
  readonly conversationId?: string;
  readonly i18n: LocalizerType;
  readonly ourServiceId: ServiceIdString | undefined;
  readonly participants: Array<CallingParticipantType>;
  readonly participantMenuDisabled?: boolean;
  readonly onClose: () => void;
  readonly renderCallingParticipantMenu: (
    props: SmartCallingParticipantMenuProps
  ) => React.JSX.Element;
  readonly showContactModal: (payload: ContactModalStateType) => void;
};

export const CallingParticipantsList = React.memo(
  function CallingParticipantsListInner({
    conversationId,
    i18n,
    onClose,
    ourServiceId,
    participants,
    participantMenuDisabled,
    showContactModal,
    renderCallingParticipantMenu,
  }: PropsType) {
    const sortedParticipants = React.useMemo<Array<CallingParticipantType>>(
      () => sortByTitle(participants),
      [participants]
    );

    const renderParticipant = React.useCallback(
      (participant: CallingParticipantType, key: React.Key) => (
        <CallingParticipantListItem
          key={key}
          callConversationId={conversationId}
          i18n={i18n}
          ourServiceId={ourServiceId}
          participant={participant}
          participantMenuDisabled={participantMenuDisabled}
          showContactModal={showContactModal}
          renderCallingParticipantMenu={renderCallingParticipantMenu}
        />
      ),
      [
        conversationId,
        i18n,
        ourServiceId,
        participantMenuDisabled,
        renderCallingParticipantMenu,
        showContactModal,
      ]
    );

    return (
      <ModalHost
        modalName="CallingParticipantsList"
        moduleClassName="CallingParticipantsList"
        onClose={onClose}
      >
        <div className="CallingParticipantsList module-calling-participants-list">
          <div className="module-calling-participants-list__header">
            <div className="module-calling-participants-list__title">
              {participants.length
                ? i18n('icu:calling__in-this-call', {
                    people: participants.length,
                  })
                : i18n('icu:calling__in-this-call--zero')}
            </div>
            <button
              type="button"
              className="module-calling-participants-list__close"
              onClick={onClose}
              tabIndex={0}
              aria-label={i18n('icu:close')}
            />
          </div>
          <div className="module-calling-participants-list__list">
            {sortedParticipants.map(renderParticipant)}
          </div>
        </div>
      </ModalHost>
    );
  }
);
