// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useRef, useState } from 'react';
import type { ActiveCallType } from '../types/Calling';
import { CallMode } from '../types/Calling';
import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import { isReconnecting } from '../util/callingIsReconnecting';
import { CallingToastProvider, useCallingToasts } from './CallingToast';
import { Spinner } from './Spinner';
import { usePrevious } from '../hooks/usePrevious';

type PropsType = {
  activeCall: ActiveCallType;
  i18n: LocalizerType;
};

export function useReconnectingToast({ activeCall, i18n }: PropsType): void {
  const { showToast, hideToast } = useCallingToasts();
  const RECONNECTING_TOAST_KEY = 'reconnecting';

  useEffect(() => {
    if (isReconnecting(activeCall)) {
      showToast({
        key: RECONNECTING_TOAST_KEY,
        content: (
          <span className="CallingToast__reconnecting">
            <Spinner svgSize="small" size="16px" />
            {i18n('icu:callReconnecting')}
          </span>
        ),
        autoClose: false,
      });
    } else {
      hideToast(RECONNECTING_TOAST_KEY);
    }
  }, [activeCall, i18n, showToast, hideToast]);
}

const ME = Symbol('me');

function getCurrentPresenter(
  activeCall: Readonly<ActiveCallType>
): ConversationType | typeof ME | undefined {
  if (activeCall.presentingSource) {
    return ME;
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
  const [previousPresenter, setPreviousPresenter] = useState<
    undefined | { id: string | typeof ME; title?: string }
  >(undefined);
  const { showToast } = useCallingToasts();

  useEffect(() => {
    const currentPresenter = getCurrentPresenter(activeCall);
    if (currentPresenter === ME) {
      setPreviousPresenter({
        id: ME,
      });
    } else if (!currentPresenter) {
      setPreviousPresenter(undefined);
    } else {
      const { id, title } = currentPresenter;
      setPreviousPresenter({ id, title });
    }
  }, [activeCall]);

  useEffect(() => {
    const currentPresenter = getCurrentPresenter(activeCall);

    if (!currentPresenter && previousPresenter && previousPresenter.title) {
      showToast({
        content:
          previousPresenter.id === ME
            ? i18n('icu:calling__presenting--you-stopped')
            : i18n('icu:calling__presenting--person-stopped', {
                name: previousPresenter.title,
              }),
        autoClose: true,
      });
    }
  }, [activeCall, previousPresenter, showToast, i18n]);
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
      maxToasts={1}
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
