// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect } from 'react';
import { usePrevious } from './usePrevious';

type RemoteParticipant = {
  hasRemoteVideo: boolean;
  presenting: boolean;
  title: string;
  uuid?: string;
};

export function useActivateSpeakerViewOnPresenting({
  remoteParticipants,
  switchToPresentationView,
  switchFromPresentationView,
}: {
  remoteParticipants: ReadonlyArray<RemoteParticipant>;
  switchToPresentationView: () => void;
  switchFromPresentationView: () => void;
}): void {
  const presenterUuid = remoteParticipants.find(
    participant => participant.presenting
  )?.uuid;
  const prevPresenterUuid = usePrevious(presenterUuid, presenterUuid);

  useEffect(() => {
    if (prevPresenterUuid !== presenterUuid && presenterUuid) {
      switchToPresentationView();
    } else if (prevPresenterUuid && !presenterUuid) {
      switchFromPresentationView();
    }
  }, [
    presenterUuid,
    prevPresenterUuid,
    switchToPresentationView,
    switchFromPresentationView,
  ]);
}
