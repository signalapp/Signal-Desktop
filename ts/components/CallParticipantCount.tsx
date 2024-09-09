// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { LocalizerType } from '../types/Util';
import { CallMode } from '../types/CallDisposition';

export type PropsType = {
  callMode: CallMode.Group | CallMode.Adhoc;
  i18n: LocalizerType;
  isAdhocJoinRequestPending?: boolean;
  groupMemberCount?: number;
  participantCount: number;
  toggleParticipants: () => void;
};

export function CallParticipantCount({
  callMode,
  i18n,
  isAdhocJoinRequestPending,
  participantCount,
  toggleParticipants,
}: PropsType): JSX.Element {
  const isToggleVisible =
    Boolean(participantCount) || callMode === CallMode.Adhoc;

  // 1 is for yourself, when the call has started but no peek info is available
  const count = participantCount || 1;

  let innerText: string | undefined;
  if (callMode === CallMode.Adhoc) {
    if (isAdhocJoinRequestPending) {
      innerText = i18n(
        'icu:CallControls__InfoDisplay--adhoc-join-request-pending'
      );
    } else if (!participantCount) {
      innerText = i18n('icu:CallControls__InfoDisplay--adhoc-call');
    }
  } else if (!participantCount) {
    innerText = i18n('icu:CallControls__InfoDisplay--group-call');
  }

  if (!innerText) {
    innerText = i18n('icu:CallControls__InfoDisplay--participants', {
      count,
    });
  }

  // Call not started, can't click to show participants
  if (!isToggleVisible) {
    return (
      <span
        aria-label={i18n('icu:calling__participants--pluralized', {
          people: count,
        })}
        className="CallControls__Status--InactiveCallParticipantCount"
      >
        {innerText}
      </span>
    );
  }

  return (
    <button
      aria-label={i18n('icu:calling__participants--pluralized', {
        people: count,
      })}
      className="CallControls__Status--ParticipantCount"
      onClick={toggleParticipants}
      type="button"
    >
      {innerText}
    </button>
  );
}
