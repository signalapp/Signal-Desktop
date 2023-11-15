// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useMemo, useRef } from 'react';
import type { ActiveCallType } from '../types/Calling';
import { CallMode } from '../types/Calling';
import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import { CallingToastProvider, useCallingToasts } from './CallingToast';
import { usePrevious } from '../hooks/usePrevious';

type PropsType = {
  activeCall: ActiveCallType;
  i18n: LocalizerType;
};

const ME = Symbol('me');

function getCurrentPresenter(
  activeCall: Readonly<ActiveCallType>
): ConversationType | { id: typeof ME } | undefined {
  if (activeCall.presentingSource) {
    return { id: ME };
  }
  if (activeCall.callMode === CallMode.Direct) {
    const isOtherPersonPresenting = activeCall.remoteParticipants.some(
      participant => participant.presenting
    );
    return isOtherPersonPresenting ? activeCall.conversation : undefined;
  }
  if (activeCall.callMode === CallMode.Group) {
    return activeCall.remoteParticipants.find(
      participant => participant.presenting
    );
  }
  return undefined;
}

export function useScreenSharingStoppedToast({
  activeCall,
  i18n,
}: PropsType): void {
  const { showToast, hideToast } = useCallingToasts();

  const SOMEONE_STOPPED_PRESENTING_TOAST_KEY = 'someone_stopped_presenting';

  const currentPresenter = useMemo(
    () => getCurrentPresenter(activeCall),
    [activeCall]
  );
  const previousPresenter = usePrevious(currentPresenter, currentPresenter);

  useEffect(() => {
    if (previousPresenter && !currentPresenter) {
      hideToast(SOMEONE_STOPPED_PRESENTING_TOAST_KEY);
      showToast({
        key: SOMEONE_STOPPED_PRESENTING_TOAST_KEY,
        content:
          previousPresenter.id === ME
            ? i18n('icu:calling__presenting--you-stopped')
            : i18n('icu:calling__presenting--person-stopped', {
                name: previousPresenter.title,
              }),
        autoClose: true,
      });
    }
  }, [
    activeCall,
    hideToast,
    currentPresenter,
    previousPresenter,
    showToast,
    i18n,
  ]);
}

function useMutedToast({
  hasLocalAudio,
  i18n,
}: {
  hasLocalAudio: boolean;
  i18n: LocalizerType;
}): void {
  const previousHasLocalAudio = usePrevious(hasLocalAudio, hasLocalAudio);
  const { showToast, hideToast } = useCallingToasts();
  const MUTED_TOAST_KEY = 'muted';

  useEffect(() => {
    if (
      previousHasLocalAudio !== undefined &&
      hasLocalAudio !== previousHasLocalAudio
    ) {
      hideToast(MUTED_TOAST_KEY);
      showToast({
        key: MUTED_TOAST_KEY,
        content: hasLocalAudio
          ? i18n('icu:CallControls__MutedToast--unmuted')
          : i18n('icu:CallControls__MutedToast--muted'),
        autoClose: true,
        dismissable: true,
      });
    }
  }, [hasLocalAudio, previousHasLocalAudio, hideToast, showToast, i18n]);
}

function useOutgoingRingToast({
  outgoingRing,
  i18n,
}: {
  outgoingRing?: boolean;
  i18n: LocalizerType;
}): void {
  const { showToast, hideToast } = useCallingToasts();
  const previousOutgoingRing = usePrevious(outgoingRing, outgoingRing);
  const RINGING_TOAST_KEY = 'ringing';

  React.useEffect(() => {
    if (outgoingRing === undefined) {
      return;
    }

    if (
      previousOutgoingRing !== undefined &&
      outgoingRing !== previousOutgoingRing
    ) {
      hideToast(RINGING_TOAST_KEY);
      showToast({
        key: RINGING_TOAST_KEY,
        content: outgoingRing
          ? i18n('icu:CallControls__RingingToast--ringing-on')
          : i18n('icu:CallControls__RingingToast--ringing-off'),
        autoClose: true,
        dismissable: true,
      });
    }
  }, [outgoingRing, previousOutgoingRing, hideToast, showToast, i18n]);
}

type CallingButtonToastsType = {
  hasLocalAudio: boolean;
  outgoingRing: boolean | undefined;
  i18n: LocalizerType;
};

export function CallingButtonToastsContainer(
  props: CallingButtonToastsType
): JSX.Element {
  const toastRegionRef = useRef<HTMLDivElement>(null);
  return (
    <CallingToastProvider
      i18n={props.i18n}
      maxNonPersistentToasts={1}
      region={toastRegionRef}
    >
      <div className="CallingButtonToasts" ref={toastRegionRef} />
      <CallingButtonToasts {...props} />
    </CallingToastProvider>
  );
}

function CallingButtonToasts({
  hasLocalAudio,
  outgoingRing,
  i18n,
}: CallingButtonToastsType) {
  useMutedToast({ hasLocalAudio, i18n });
  useOutgoingRingToast({ outgoingRing, i18n });

  return null;
}
