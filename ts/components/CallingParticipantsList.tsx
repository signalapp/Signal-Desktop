// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable react/no-array-index-key */

import React from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from './Avatar';
import { ColorType } from '../types/Colors';
import { ContactName } from './conversation/ContactName';
import { LocalizerType } from '../types/Util';

type ParticipantType = {
  audioMuted?: boolean;
  avatarPath?: string;
  color?: ColorType;
  profileName?: string;
  title: string;
  videoMuted?: boolean;
};

export type PropsType = {
  readonly i18n: LocalizerType;
  readonly onClose: () => void;
  readonly participants: Array<ParticipantType>;
};

export const CallingParticipantsList = React.memo(
  ({ i18n, onClose, participants }: PropsType) => {
    const [root, setRoot] = React.useState<HTMLElement | null>(null);

    React.useEffect(() => {
      const div = document.createElement('div');
      document.body.appendChild(div);
      setRoot(div);

      return () => {
        document.body.removeChild(div);
        setRoot(null);
      };
    }, []);

    if (!root) {
      return null;
    }

    return createPortal(
      <div
        role="presentation"
        className="module-calling-participants-list__overlay"
      >
        <div className="module-calling-participants-list">
          <div className="module-calling-participants-list__header">
            <div className="module-calling-participants-list__title">
              {participants.length > 1
                ? i18n('calling__in-this-call--many', [
                    String(participants.length),
                  ])
                : i18n('calling__in-this-call--one')}
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
            {participants.map((participant: ParticipantType, index: number) => (
              <li
                className="module-calling-participants-list__contact"
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
                  <ContactName
                    i18n={i18n}
                    module="module-calling-participants-list__name"
                    title={participant.title}
                  />
                </div>
                <div>
                  {participant.audioMuted ? (
                    <span className="module-calling-participants-list__muted--audio" />
                  ) : null}
                  {participant.videoMuted ? (
                    <span className="module-calling-participants-list__muted--video" />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>,
      root
    );
  }
);
