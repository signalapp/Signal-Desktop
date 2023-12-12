// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/Util';

export type PropsType = {
  i18n: LocalizerType;
  groupMemberCount?: number;
  participantCount: number;
  toggleParticipants: () => void;
};

export function CallParticipantCount({
  i18n,
  groupMemberCount,
  participantCount,
  toggleParticipants,
}: PropsType): JSX.Element {
  const count = participantCount || groupMemberCount || 1;
  const innerText = i18n('icu:CallControls__InfoDisplay--participants', {
    count: String(count),
  });

  // Call not started, can't click to show participants
  if (!participantCount) {
    return (
      <span
        aria-label={i18n('icu:calling__participants', {
          people: String(count),
        })}
        className="CallControls__Status--InactiveCallParticipantCount"
      >
        {innerText}
      </span>
    );
  }

  return (
    <button
      aria-label={i18n('icu:calling__participants', {
        people: String(count),
      })}
      className="CallControls__Status--ParticipantCount"
      onClick={toggleParticipants}
      type="button"
    >
      {innerText}
    </button>
  );
}
