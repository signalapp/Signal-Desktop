// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable react/no-array-index-key */

import React from 'react';
import { createPortal } from 'react-dom';
import FocusTrap from 'focus-trap-react';

import { Avatar } from './Avatar';
import { ContactName } from './conversation/ContactName';
import { InContactsIcon } from './InContactsIcon';
import type { LocalizerType } from '../types/Util';
import { sortByTitle } from '../util/sortByTitle';
import type { ConversationType } from '../state/ducks/conversations';
import { isInSystemContacts } from '../util/isInSystemContacts';

type ParticipantType = ConversationType & {
  hasRemoteAudio?: boolean;
  hasRemoteVideo?: boolean;
  presenting?: boolean;
};

export type PropsType = {
  readonly i18n: LocalizerType;
  readonly onClose: () => void;
  readonly ourUuid: string | undefined;
  readonly participants: Array<ParticipantType>;
};

export const CallingParticipantsList = React.memo(
  ({ i18n, onClose, ourUuid, participants }: PropsType) => {
    const [root, setRoot] = React.useState<HTMLElement | null>(null);

    const sortedParticipants = React.useMemo<Array<ParticipantType>>(
      () => sortByTitle(participants),
      [participants]
    );

    React.useEffect(() => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      setRoot(div);

      return () => {
        document.body.removeChild(div);
        setRoot(null);
      };
    }, []);

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
                {!participants.length && i18n('calling__in-this-call--zero')}
                {participants.length === 1 &&
                  i18n('calling__in-this-call--one')}
                {participants.length > 1 &&
                  i18n('calling__in-this-call--many', [
                    String(participants.length),
                  ])}
              </div>
              <button
                type="button"
                className="module-calling-participants-list__close"
                onClick={onClose}
                tabIndex={0}
                aria-label={i18n('close')}
              />
            </div>
            <ul className="module-calling-participants-list__list">
              {sortedParticipants.map(
                (participant: ParticipantType, index: number) => (
                  <li
                    className="module-calling-participants-list__contact"
                    // It's tempting to use `participant.uuid` as the `key` here, but that
                    //   can result in duplicate keys for participants who have joined on
                    //   multiple devices.
                    key={index}
                  >
                    <div>
                      <Avatar
                        acceptedMessageRequest={
                          participant.acceptedMessageRequest
                        }
                        avatarPath={participant.avatarPath}
                        badge={undefined}
                        color={participant.color}
                        conversationType="direct"
                        i18n={i18n}
                        isMe={participant.isMe}
                        profileName={participant.profileName}
                        title={participant.title}
                        sharedGroupNames={participant.sharedGroupNames}
                        size={32}
                      />
                      {ourUuid && participant.uuid === ourUuid ? (
                        <span className="module-calling-participants-list__name">
                          {i18n('you')}
                        </span>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                    <div>
                      {participant.hasRemoteAudio === false ? (
                        <span className="module-calling-participants-list__muted--audio" />
                      ) : null}
                      {participant.hasRemoteVideo === false ? (
                        <span className="module-calling-participants-list__muted--video" />
                      ) : null}
                      {participant.presenting ? (
                        <span className="module-calling-participants-list__presenting" />
                      ) : null}
                    </div>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
      </FocusTrap>,
      root
    );
  }
);
