// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useMemo, useRef } from 'react';
import type { ActiveCallType } from '../types/Calling';
import { CallMode } from '../types/Calling';
import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import { CallingToastProvider, useCallingToasts } from './CallingToast';
import { usePrevious } from '../hooks/usePrevious';
import {
  difference as setDifference,
  isEqual as setIsEqual,
} from '../util/setUtil';
import * as log from '../logging/log';

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

function useRaisedHandsToast({
  raisedHands,
  renderRaisedHandsToast,
}: {
  raisedHands?: Set<number>;
  renderRaisedHandsToast?: (
    hands: Array<number>
  ) => JSX.Element | string | undefined;
}): void {
  const RAISED_HANDS_TOAST_KEY = 'raised-hands';
  const LOAD_DELAY = 2000;
  const { showToast, hideToast } = useCallingToasts();

  // Hand state is updated after a delay upon joining a call, so it can appear that
  // hands were raised immediately when you join a call. To avoid spurious toasts, add
  // an initial delay before showing toasts.
  const [isLoaded, setIsLoaded] = React.useState<boolean>(false);
  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoaded(true);
    }, LOAD_DELAY);
    return () => clearTimeout(timeout);
  }, []);

  const previousRaisedHands = usePrevious(raisedHands, raisedHands);
  const [newHands, loweredHands]: [Set<number>, Set<number>] = isLoaded
    ? [
        setDifference(
          raisedHands ?? new Set(),
          previousRaisedHands ?? new Set()
        ),
        setDifference(
          previousRaisedHands ?? new Set(),
          raisedHands ?? new Set()
        ),
      ]
    : [new Set(), new Set()];

  const raisedHandsInLastShownToastRef = useRef<Set<number>>(new Set());
  const raisedHandsInLastShownToast = raisedHandsInLastShownToastRef.current;

  React.useEffect(() => {
    // 1. If no hands are raised, then hide any raise hand toast.
    // 2. Check if someone lowered their hand which they had recently raised. The
    // previous toast saying they raised their hand would now be out of date, so we
    // should hide it.
    if (
      raisedHands?.size === 0 ||
      (raisedHandsInLastShownToast.size > 0 &&
        loweredHands.size > 0 &&
        setIsEqual(raisedHandsInLastShownToast, loweredHands))
    ) {
      hideToast(RAISED_HANDS_TOAST_KEY);
    }

    if (newHands.size === 0 || !renderRaisedHandsToast) {
      return;
    }

    const content = renderRaisedHandsToast([...newHands].reverse());
    if (!content) {
      log.warn(
        'CallingToastManager useRaisedHandsToast: Failed to call renderRaisedHandsToast()'
      );
      return;
    }

    hideToast(RAISED_HANDS_TOAST_KEY);
    // Note: Don't set { dismissable: true } or else the links (Lower or View Queue)
    // will cause nested buttons (dismissable toasts are <button>s)
    showToast({
      key: RAISED_HANDS_TOAST_KEY,
      content,
      autoClose: true,
    });
    raisedHandsInLastShownToastRef.current = newHands;
  }, [
    raisedHands,
    previousRaisedHands,
    newHands,
    raisedHandsInLastShownToast,
    loweredHands,
    renderRaisedHandsToast,
    hideToast,
    showToast,
  ]);
}

type CallingButtonToastsType = {
  hasLocalAudio: boolean;
  outgoingRing: boolean | undefined;
  raisedHands?: Set<number>;
  renderRaisedHandsToast?: (
    hands: Array<number>
  ) => JSX.Element | string | undefined;
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
      <div className="CallingButtonToasts__outer">
        <div className="CallingButtonToasts" ref={toastRegionRef} />
        <CallingButtonToasts {...props} />
      </div>
    </CallingToastProvider>
  );
}

function CallingButtonToasts({
  hasLocalAudio,
  outgoingRing,
  raisedHands,
  renderRaisedHandsToast,
  i18n,
}: CallingButtonToastsType) {
  useMutedToast({ hasLocalAudio, i18n });
  useOutgoingRingToast({ outgoingRing, i18n });
  useRaisedHandsToast({ raisedHands, renderRaisedHandsToast });

  return null;
}
