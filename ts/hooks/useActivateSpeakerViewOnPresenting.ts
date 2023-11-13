// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo } from 'react';
import type { AciString } from '../types/ServiceId';
import { usePrevious } from './usePrevious';

type RemoteParticipant = {
  hasRemoteVideo: boolean;
  presenting: boolean;
  title: string;
  aci?: AciString;
};

export function usePresenter(
  remoteParticipants: ReadonlyArray<RemoteParticipant>
): AciString | undefined {
  return useMemo(
    () => remoteParticipants.find(participant => participant.presenting)?.aci,
    [remoteParticipants]
  );
}

export function useActivateSpeakerViewOnPresenting({
  remoteParticipants,
  switchToPresentationView,
  switchFromPresentationView,
}: {
  remoteParticipants: ReadonlyArray<RemoteParticipant>;
  switchToPresentationView: () => void;
  switchFromPresentationView: () => void;
}): void {
  const presenterAci = usePresenter(remoteParticipants);
  const prevPresenterAci = usePrevious(presenterAci, presenterAci);

  useEffect(() => {
    if (prevPresenterAci !== presenterAci && presenterAci) {
      switchToPresentationView();
    } else if (prevPresenterAci && !presenterAci) {
      switchFromPresentationView();
    }
  }, [
    presenterAci,
    prevPresenterAci,
    switchToPresentationView,
    switchFromPresentationView,
  ]);
}
