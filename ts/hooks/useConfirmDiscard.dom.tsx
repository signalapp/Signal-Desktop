// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useRef, useState } from 'react';

import { ConfirmDiscardDialog } from '../components/ConfirmDiscardDialog.dom.js';
import {
  BeforeNavigateResponse,
  beforeNavigateService,
} from '../services/BeforeNavigate.std.js';
import {
  explodePromise,
  type ExplodePromiseResultType,
} from '../util/explodePromise.std.js';

import type { ConfirmDialogProps } from '../components/ConfirmDiscardDialog.dom.js';
import type { LocalizerType } from '../types/Util.std.js';

export function useConfirmDiscard({
  i18n,
  bodyText,
  discardText,
  name,
  tryClose,
}: {
  i18n: LocalizerType;
  bodyText?: string;
  discardText?: string;
  name: string;
  tryClose?: React.MutableRefObject<(() => void) | undefined>;
}): [
  JSX.Element | null,
  (condition: boolean, discardChanges: () => void, cancel?: () => void) => void,
] {
  const [props, setProps] = useState<Omit<
    ConfirmDialogProps,
    'i18n' | 'bodyText' | 'discardText'
  > | null>(null);
  const confirmElement = props ? (
    <ConfirmDiscardDialog
      i18n={i18n}
      bodyText={bodyText}
      discardText={discardText}
      {...props}
    />
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
    beforeNavigateService.registerCallback({
      name,
      callback,
    });

    return () => {
      beforeNavigateService.unregisterCallback({
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
