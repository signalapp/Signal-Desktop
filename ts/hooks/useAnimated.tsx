// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useCallback } from 'react';
import type { SpringValues } from '@react-spring/web';
import { useChain, useSpring, useSpringRef } from '@react-spring/web';
import { useReducedMotion } from './useReducedMotion';

export type ModalConfigType = {
  opacity: number;
  transform?: string;
  marginTop?: string;
};

enum ModalState {
  Opening = 'Opening',
  Open = 'Open',
  Closing = 'Closing',
  Closed = 'Closed',
}

export function useAnimated(
  onClose: () => unknown,
  {
    getFrom,
    getTo,
  }: {
    getFrom: (isOpen: boolean) => ModalConfigType;
    getTo: (isOpen: boolean) => ModalConfigType;
  }
): {
  close: () => unknown;
  isClosed: boolean;
  modalStyles: SpringValues<ModalConfigType>;
  overlayStyles: SpringValues<ModalConfigType>;
} {
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState(ModalState.Opening);
  const shouldShowModal =
    state === ModalState.Open || state === ModalState.Opening;
  const isClosed = state === ModalState.Closed;

  const modalRef = useSpringRef();

  const modalStyles = useSpring({
    immediate: reducedMotion,
    from: getFrom(shouldShowModal),
    to: getTo(shouldShowModal),
    onRest: () => {
      if (state === ModalState.Closing) {
        setState(ModalState.Closed);
        onClose();
      } else if (state === ModalState.Opening) {
        setState(ModalState.Open);
      }
    },
    config: {
      clamp: true,
      friction: 20,
      mass: 0.5,
      tension: 350,
    },
    ref: modalRef,
  });

  const overlayRef = useSpringRef();

  const overlayStyles = useSpring({
    from: { opacity: 0 },
    to: { opacity: shouldShowModal ? 1 : 0 },
    config: {
      clamp: true,
      friction: 22,
      tension: 360,
    },
    ref: overlayRef,
  });

  useChain(shouldShowModal ? [overlayRef, modalRef] : [modalRef, overlayRef]);
  const close = useCallback(() => {
    setState(currentState => {
      if (
        currentState === ModalState.Open ||
        currentState === ModalState.Opening
      ) {
        return ModalState.Closing;
      }
      return currentState;
    });
  }, []);

  return {
    close,
    isClosed,
    overlayStyles,
    modalStyles,
  };
}
