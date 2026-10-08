// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, JSX } from 'react';
import { useRef, useEffect, Children } from 'react';
import classNames from 'classnames';

import { usePreviousDeprecated } from '../hooks/usePrevious.std.ts';
import { scrollToBottom } from '../util/scrollUtil.std.ts';

type PropsType = {
  /** @deprecated */
  className?: string;
  children?: ReactNode;
};

export function ContactPills({ className, children }: PropsType): JSX.Element {
  const elRef = useRef<null | HTMLDivElement>(null);

  // oxlint-disable-next-line no-react-children
  const childCount = Children.count(children);
  const previousChildCount = usePreviousDeprecated(0, childCount);

  useEffect(() => {
    const hasAddedNewChild = childCount > previousChildCount;
    const el = elRef.current;
    if (hasAddedNewChild && el) {
      scrollToBottom(el);
    }
  }, [childCount, previousChildCount]);

  return (
    <div className={classNames('module-ContactPills', className)} ref={elRef}>
      {children}
    </div>
  );
}
