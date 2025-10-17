// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useEffect } from 'react';
import { noop } from 'lodash';

type InternalState<Value> = Readonly<
  | {
      type: 'transition';
      from: Value;
      to: Value;
    }
  | {
      type: 'idle';
      value: Value;
    }
>;

export function useDelayedValue<Value>(newValue: Value, delay: number): Value {
  const [state, setState] = useState<InternalState<Value>>({
    type: 'idle',
    value: newValue,
  });

  const currentValue = state.type === 'idle' ? state.value : state.from;

  useEffect(() => {
    if (state.type === 'idle') {
      return noop;
    }

    const timer = setTimeout(() => {
      setState({
        type: 'idle',
        value: state.to,
      });
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [state, delay]);

  useEffect(() => {
    setState(prevState => {
      if (prevState.type === 'transition') {
        return {
          type: 'transition',
          from: prevState.from,
          to: newValue,
        };
      }

      return {
        type: 'transition',
        from: prevState.value,
        to: newValue,
      };
    });
  }, [newValue]);

  return currentValue;
}
