// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC, ReactNode } from 'react';
import { memo, useCallback, useId, useMemo, useState } from 'react';
import { Slot } from 'radix-ui';
import {
  createStrictContext,
  useStrictContext,
} from '../_internal/StrictContext.dom.tsx';
import { assert } from '../_internal/assert.std.tsx';

export namespace AriaLabelled {
  type Ids = ReadonlySet<string>;

  type Unregister = () => void;
  type Register = (element: Element | null) => Unregister;

  function useIds(): [Ids, Register] {
    const [ids, setIds] = useState<Ids>(() => new Set());

    const register: Register = useCallback(element => {
      assert(element != null, 'must be rendered in react 19 or higher');
      const id = element.id;
      assert(id !== '', 'element is missing id');
      setIds(prev => {
        const copy = new Set(prev);
        copy.add(id);
        return copy;
      });
      return () => {
        setIds(prev => {
          const copy = new Set(prev);
          copy.delete(id);
          return copy;
        });
      };
    }, []);

    return [ids, register];
  }

  function concatIds(input: Ids): string | undefined {
    if (input.size === 0) {
      return undefined;
    }
    return Array.from(input).join(' ');
  }

  type RootContextType = Readonly<{
    registerLabel: Register;
    registerDescription: Register;
  }>;

  const RootContext = createStrictContext<RootContextType>('AxoLabelled.Root');

  /**
   * <AriaLabelled.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    asChild?: boolean;
    id?: string;
    label?: string;
    description?: string;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const { label, description } = props;
    const Comp = props.asChild ? Slot.Root : 'div';
    const fallbackId = useId();
    const id = props.id ?? fallbackId;

    const [labels, registerLabel] = useIds();
    const [descriptions, registerDescription] = useIds();

    const context = useMemo((): RootContextType => {
      return { registerLabel, registerDescription };
    }, [registerLabel, registerDescription]);

    const labelProps = useMemo(() => {
      let labelledBy = concatIds(labels);
      let describbedBy = concatIds(descriptions);

      if (label != null && labelledBy != null) {
        labelledBy = `${id} ${labelledBy}`;
      }

      if (description != null && describbedBy != null) {
        describbedBy = `${id} ${describbedBy}`;
      }

      return {
        id,
        'aria-label': label,
        'aria-description': description,
        'aria-labelledby': labelledBy,
        'aria-describedby': describbedBy,
      };
    }, [id, label, description, labels, descriptions]);

    return (
      <RootContext value={context}>
        <Comp {...labelProps}>{props.children}</Comp>
      </RootContext>
    );
  });

  Root.displayName = 'AriaLabelled.Root';

  /**
   * <AriaLabelled.Label>
   * --------------------------------------------------------------------------
   */

  export type LabelProps = Readonly<{
    asChild?: boolean;
    id?: string;
    children: ReactNode;
  }>;

  export const Label: FC<LabelProps> = memo(props => {
    const Comp = props.asChild ? Slot.Root : 'div';
    const fallbackId = useId();
    const { registerLabel } = useStrictContext(RootContext);
    return (
      <Comp ref={registerLabel} id={props.id ?? fallbackId}>
        {props.children}
      </Comp>
    );
  });

  Label.displayName = 'AriaLabelled.Label';

  /**
   * <AriaLabelled.Description>
   * --------------------------------------------------------------------------
   */

  export type DescriptionProps = Readonly<{
    asChild?: boolean;
    id?: string;
    children: ReactNode;
  }>;

  export const Description: FC<DescriptionProps> = memo(props => {
    const Comp = props.asChild ? Slot.Root : 'div';
    const fallbackId = useId();
    const { registerDescription } = useStrictContext(RootContext);
    return (
      <Comp ref={registerDescription} id={props.id ?? fallbackId}>
        {props.children}
      </Comp>
    );
  });

  Description.displayName = 'AriaLabelled.Description';
}
