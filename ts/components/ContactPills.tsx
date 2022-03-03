// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent, ReactNode } from 'react';
import React, { useRef, useEffect, Children } from 'react';

import { usePrevious } from '../hooks/usePrevious';
import { scrollToBottom } from '../util/scrollUtil';

type PropsType = {
  children?: ReactNode;
};

export const ContactPills: FunctionComponent<PropsType> = ({ children }) => {
  const elRef = useRef<null | HTMLDivElement>(null);

  const childCount = Children.count(children);
  const previousChildCount = usePrevious(0, childCount);

  useEffect(() => {
    const hasAddedNewChild = childCount > previousChildCount;
    const el = elRef.current;
    if (hasAddedNewChild && el) {
      scrollToBottom(el);
    }
  }, [childCount, previousChildCount]);

  return (
    <div className="module-ContactPills" ref={elRef}>
      {children}
    </div>
  );
};
