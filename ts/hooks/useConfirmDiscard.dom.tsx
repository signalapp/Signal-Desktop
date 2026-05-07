// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState, type RefObject, type JSX } from 'react';

import { ConfirmDiscardDialog } from '../components/ConfirmDiscardDialog.dom.tsx';
import {
  BeforeNavigateResponse,
  beforeNavigateService,
} from '../services/BeforeNavigate.std.ts';
import {
  explodePromise,
  type ExplodePromiseResultType,
} from '../util/explodePromise.std.ts';

import type { ConfirmDialogProps } from '../components/ConfirmDiscardDialog.dom.tsx';
import type { LocalizerType } from '../types/Util.std.ts';

/** @deprecated */
export function useConfirmDiscard({
  i18n,
  title,
  description,
  cancelLabel,
  discardLabel,
  name,
  tryClose,
}: {
  i18n: LocalizerType;
  title: string;
  description: string;
  cancelLabel?: string;
  discardLabel?: string;
  name: string;
  tryClose?: RefObject<(() => void) | null>;
}): [
  JSX.Element | null,
  (condition: boolean, discardChanges: () => void, cancel?: () => void) => void,
] {
  const [props, setProps] = useState<Omit<
    ConfirmDialogProps,
    'i18n' | 'title' | 'description' | 'cancelLabel' | 'discardLabel'
  > | null>(null);
  const confirmElement = props ? (
    <ConfirmDiscardDialog
      i18n={i18n}
      title={title}
      description={description}
      cancelLabel={cancelLabel}
      discardLabel={discardLabel}
      {...props}
    />
  ) : null;
  const confirmDiscardPromise = useRef<
    ExplodePromiseResultType<BeforeNavigateResponse> | undefined
  >(undefined);

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
