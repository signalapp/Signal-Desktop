// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';
import type { ActiveCallType } from '../types/Calling';
import { CallMode } from '../types/Calling';
import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import { isReconnecting } from '../util/callingIsReconnecting';
import { useCallingToasts } from './CallingToast';
import { Spinner } from './Spinner';

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
