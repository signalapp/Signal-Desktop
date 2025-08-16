// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useRef, useState } from 'react';

import { ConfirmDiscardDialog } from '../components/ConfirmDiscardDialog';
import { BeforeNavigateResponse } from '../services/BeforeNavigate';
import {
  explodePromise,
  type ExplodePromiseResultType,
} from '../util/explodePromise';

import type { PropsType } from '../components/ConfirmDiscardDialog';
import type { LocalizerType } from '../types/Util';

export function useConfirmDiscard({
  i18n,
  name,
  tryClose,
}: {
  i18n: LocalizerType;
  name: string;
  tryClose?: React.MutableRefObject<(() => void) | undefined>;
}): [
  JSX.Element | null,
  (condition: boolean, discardChanges: () => void, cancel?: () => void) => void,
] {
  const [props, setProps] = useState<Omit<PropsType, 'i18n'> | null>(null);
  const confirmElement = props ? (
    <ConfirmDiscardDialog i18n={i18n} {...props} />
  ) : null;
  const confirmDiscardPromise = useRef<
    ExplodePromiseResultType<BeforeNavigateResponse> | undefined
  >();

  useEffect(() => {
    if (!tryClose) {
      return;
    }

    const callback = async () => {
      const close = tryClose.current;
      if (!close) {
        return BeforeNavigateResponse.Noop;
      }

      confirmDiscardPromise.current = explodePromise<BeforeNavigateResponse>();
      close();
      return confirmDiscardPromise.current.promise;
    };
    window.Signal.Services.beforeNavigate.registerCallback({
      name,
      callback,
    });

    return () => {
      window.Signal.Services.beforeNavigate.unregisterCallback({
        name,
        callback,
      });
    };
  }, [name, tryClose, confirmDiscardPromise]);

  function confirmDiscardIf(
    condition: boolean,
    discardChanges: () => void,
    cancel?: () => void
  ) {
    if (condition) {
      setProps({
        onClose() {
          confirmDiscardPromise.current?.resolve(
            BeforeNavigateResponse.CancelNavigation
          );
          setProps(null);
          cancel?.();
        },
        onDiscard() {
          confirmDiscardPromise.current?.resolve(
            BeforeNavigateResponse.WaitedForUser
          );
          discardChanges();
        },
      });
    } else {
      confirmDiscardPromise.current?.resolve(BeforeNavigateResponse.Noop);
      discardChanges();
    }
  }

  return [confirmElement, confirmDiscardIf];
}
