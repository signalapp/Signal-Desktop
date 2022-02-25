// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ActiveCallType } from '../types/Calling';
import { CallMode, GroupCallConnectionState } from '../types/Calling';
import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import { clearTimeoutIfNecessary } from '../util/clearTimeoutIfNecessary';
import { CallingToast, DEFAULT_LIFETIME } from './CallingToast';

type PropsType = {
  activeCall: ActiveCallType;
  i18n: LocalizerType;
};

type ToastType =
  | {
      message: string;
      type: 'dismissable' | 'static';
    }
  | undefined;

function getReconnectingToast({ activeCall, i18n }: PropsType): ToastType {
  if (
    activeCall.callMode === CallMode.Group &&
    activeCall.connectionState === GroupCallConnectionState.Reconnecting
  ) {
    return {
      message: i18n('callReconnecting'),
      type: 'static',
    };
  }
  return undefined;
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

function useScreenSharingToast({ activeCall, i18n }: PropsType): ToastType {
  const [result, setResult] = useState<undefined | ToastType>(undefined);

  const [previousPresenter, setPreviousPresenter] = useState<
    undefined | { id: string | typeof ME; title?: string }
  >(undefined);

  const previousPresenterId = previousPresenter?.id;
  const previousPresenterTitle = previousPresenter?.title;

  useEffect(() => {
    const currentPresenter = getCurrentPresenter(activeCall);
    if (!currentPresenter && previousPresenterId) {
      if (previousPresenterId === ME) {
        setResult({
          type: 'dismissable',
          message: i18n('calling__presenting--you-stopped'),
        });
      } else if (previousPresenterTitle) {
        setResult({
          type: 'dismissable',
          message: i18n('calling__presenting--person-stopped', [
            previousPresenterTitle,
          ]),
        });
      }
    }
  }, [activeCall, i18n, previousPresenterId, previousPresenterTitle]);

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

  return result;
}

// In the future, this component should show toasts when users join or leave. See
//   DESKTOP-902.
export const CallingToastManager: React.FC<PropsType> = props => {
  const reconnectingToast = getReconnectingToast(props);
  const screenSharingToast = useScreenSharingToast(props);

  let toast: ToastType;
  if (reconnectingToast) {
    toast = reconnectingToast;
  } else if (screenSharingToast) {
    toast = screenSharingToast;
  }

  const [toastMessage, setToastMessage] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const dismissToast = useCallback(() => {
    if (timeoutRef) {
      setToastMessage('');
    }
  }, [setToastMessage, timeoutRef]);

  useEffect(() => {
    if (toast) {
      if (toast.type === 'dismissable') {
        clearTimeoutIfNecessary(timeoutRef.current);
        timeoutRef.current = setTimeout(dismissToast, DEFAULT_LIFETIME);
      }

      setToastMessage(toast.message);
    }

    return () => {
      clearTimeoutIfNecessary(timeoutRef.current);
    };
  }, [dismissToast, setToastMessage, timeoutRef, toast]);

  return (
    <CallingToast isVisible={Boolean(toastMessage)} onClick={dismissToast}>
      {toastMessage}
    </CallingToast>
  );
};
