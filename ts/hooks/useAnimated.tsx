// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import type { SpringValues } from '@react-spring/web';
import { useChain, useSpring, useSpringRef } from '@react-spring/web';

export type ModalConfigType = {
  opacity: number;
  transform?: string;
};

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
  modalStyles: SpringValues<ModalConfigType>;
  overlayStyles: SpringValues<ModalConfigType>;
} {
  const [isOpen, setIsOpen] = useState(true);

  const modalRef = useSpringRef();

  const modalStyles = useSpring({
    from: getFrom(isOpen),
    to: getTo(isOpen),
    onRest: () => {
      if (!isOpen) {
        onClose();
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
    to: { opacity: isOpen ? 1 : 0 },
    config: {
      clamp: true,
      friction: 22,
      tension: 360,
    },
    ref: overlayRef,
  });

  useChain(isOpen ? [overlayRef, modalRef] : [modalRef, overlayRef]);

  return {
    close: () => setIsOpen(false),
    overlayStyles,
    modalStyles,
  };
}
