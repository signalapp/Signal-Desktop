// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable react/no-array-index-key */

import React from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from './Avatar';
import { ContactName } from './conversation/ContactName';
import { InContactsIcon } from './InContactsIcon';
import { LocalizerType } from '../types/Util';
import { sortByTitle } from '../util/sortByTitle';
import { ConversationType } from '../state/ducks/conversations';

interface ParticipantType extends ConversationType {
  hasAudio?: boolean;
  hasVideo?: boolean;
}

export type PropsType = {
  readonly i18n: LocalizerType;
  readonly onClose: () => void;
  readonly ourUuid: string;
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
      <div
        className="module-calling-participants-list__overlay"
        onClick={handleCancel}
        role="presentation"
      >
        <div className="module-calling-participants-list">
          <div className="module-calling-participants-list__header">
            <div className="module-calling-participants-list__title">
              {!participants.length && i18n('calling__in-this-call--zero')}
              {participants.length === 1 && i18n('calling__in-this-call--one')}
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
                      avatarPath={participant.avatarPath}
                      color={participant.color}
                      conversationType="direct"
                      i18n={i18n}
                      profileName={participant.profileName}
                      title={participant.title}
                      size={32}
                    />
                    {participant.uuid === ourUuid ? (
                      <span className="module-calling-participants-list__name">
                        {i18n('you')}
                      </span>
                    ) : (
                      <>
                        <ContactName
                          i18n={i18n}
                          module="module-calling-participants-list__name"
                          title={participant.title}
                        />
                        {participant.name ? (
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
                    {participant.hasAudio === false ? (
                      <span className="module-calling-participants-list__muted--audio" />
                    ) : null}
                    {participant.hasVideo === false ? (
                      <span className="module-calling-participants-list__muted--video" />
                    ) : null}
                  </div>
                </li>
              )
            )}
          </ul>
        </div>
      </div>,
      root
    );
  }
);
