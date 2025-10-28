// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useRef, useEffect, Children } from 'react';
import classNames from 'classnames';

import { usePrevious } from '../hooks/usePrevious.std.js';
import { scrollToBottom } from '../util/scrollUtil.std.js';

type PropsType = {
  moduleClassName?: string;
  children?: ReactNode;
};

export function ContactPills({
  moduleClassName,
  children,
}: PropsType): JSX.Element {
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
    <div
      className={classNames('module-ContactPills', moduleClassName)}
      ref={elRef}
    >
      {children}
    </div>
  );
}
