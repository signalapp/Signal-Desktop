// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable react/no-array-index-key */

import React, { useContext } from 'react';
import { createPortal } from 'react-dom';
import FocusTrap from 'focus-trap-react';
import classNames from 'classnames';

import { Avatar, AvatarSize } from './Avatar';
import { ContactName } from './conversation/ContactName';
import { InContactsIcon } from './InContactsIcon';
import type { LocalizerType } from '../types/Util';
import type { ServiceIdString } from '../types/ServiceId';
import { sortByTitle } from '../util/sortByTitle';
import type { ConversationType } from '../state/ducks/conversations';
import { isInSystemContacts } from '../util/isInSystemContacts';
import { ModalContainerContext } from './ModalHost';

type ParticipantType = ConversationType & {
  hasRemoteAudio?: boolean;
  hasRemoteVideo?: boolean;
  isHandRaised?: boolean;
  presenting?: boolean;
};

export type PropsType = {
  readonly conversationId: string;
  readonly i18n: LocalizerType;
  readonly onClose: () => void;
  readonly ourServiceId: ServiceIdString | undefined;
  readonly participants: Array<ParticipantType>;
  readonly showContactModal: (
    contactId: string,
    conversationId?: string
  ) => void;
};

export const CallingParticipantsList = React.memo(
  function CallingParticipantsListInner({
    conversationId,
    i18n,
    onClose,
    ourServiceId,
    participants,
    showContactModal,
  }: PropsType) {
    const [root, setRoot] = React.useState<HTMLElement | null>(null);

    const modalContainer = useContext(ModalContainerContext) ?? document.body;

    const sortedParticipants = React.useMemo<Array<ParticipantType>>(
      () => sortByTitle(participants),
      [participants]
    );

    React.useEffect(() => {
      const div = document.createElement('div');
      modalContainer.appendChild(div);
      setRoot(div);

      return () => {
        modalContainer.removeChild(div);
        setRoot(null);
      };
    }, [modalContainer]);

    const handleCancel = React.useCallback(
      (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      },
      [onClose]
    );

    if (!root) {
      return null;
    }

    return createPortal(
      <FocusTrap>
        <div
          className="module-calling-participants-list__overlay"
          onClick={handleCancel}
          role="presentation"
        >
          <div className="module-calling-participants-list">
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
              {sortedParticipants.map(
                (participant: ParticipantType, index: number) => (
                  <button
                    aria-label={i18n('icu:calling__ParticipantInfoButton')}
                    className="module-calling-participants-list__contact"
                    disabled={participant.isMe}
                    // It's tempting to use `participant.serviceId` as the `key`
                    //   here, but that can result in duplicate keys for
                    //   participants who have joined on multiple devices.
                    key={index}
                    onClick={() => {
                      if (participant.isMe) {
                        return;
                      }

                      onClose();
                      showContactModal(participant.id, conversationId);
                    }}
                    type="button"
                  >
                    <div className="module-calling-participants-list__avatar-and-name">
                      <Avatar
                        acceptedMessageRequest={
                          participant.acceptedMessageRequest
                        }
                        avatarUrl={participant.avatarUrl}
                        badge={undefined}
                        color={participant.color}
                        conversationType="direct"
                        i18n={i18n}
                        isMe={participant.isMe}
                        profileName={participant.profileName}
                        title={participant.title}
                        sharedGroupNames={participant.sharedGroupNames}
                        size={AvatarSize.THIRTY_TWO}
                      />
                      {ourServiceId &&
                      participant.serviceId === ourServiceId ? (
                        <span className="module-calling-participants-list__name">
                          {i18n('icu:you')}
                        </span>
                      ) : (
                        <>
                          <ContactName
                            module="module-calling-participants-list__name"
                            title={participant.title}
                          />
                          {isInSystemContacts(participant) ? (
                            <InContactsIcon
                              className="module-calling-participants-list__contact-icon"
                              i18n={i18n}
                            />
                          ) : null}
                        </>
                      )}
                    </div>
                    <span
                      className={classNames(
                        'module-calling-participants-list__status-icon',
                        participant.isHandRaised &&
                          'module-calling-participants-list__hand-raised'
                      )}
                    />
                    <span
                      className={classNames(
                        'module-calling-participants-list__status-icon',
                        participant.presenting &&
                          'module-calling-participants-list__presenting',
                        !participant.hasRemoteVideo &&
                          'module-calling-participants-list__muted--video'
                      )}
                    />
                    <span
                      className={classNames(
                        'module-calling-participants-list__status-icon',
                        !participant.hasRemoteAudio &&
                          'module-calling-participants-list__muted--audio'
                      )}
                    />
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </FocusTrap>,
      root
    );
  }
);
