// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { ReactNode } from 'react';
import ReactDOM from 'react-dom';
import { ModalContainerContext } from './ModalHost.dom.js';

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Provide a div directly under the document.body that Modals can use as a DOM parent.
 *
 * Useful when you want to control the stacking context of all children, by customizing
 * the styles of the container in way that also applies to modals.
 */
export const ModalContainer = ({ children, className }: Props): JSX.Element => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  return ReactDOM.createPortal(
    <div ref={containerRef} className={className}>
      <ModalContainerContext.Provider value={containerRef.current}>
        {children}
      </ModalContainerContext.Provider>
    </div>,
    document.body
  );
};
