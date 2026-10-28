// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC, HTMLAttributes, ReactNode } from 'react';
import { memo, useCallback, useId, useMemo, useRef, useState } from 'react';
import { Slot } from 'radix-ui';
import {
  createStrictContext,
  useStrictContext,
} from '../_internal/StrictContext.dom.tsx';
import { assert } from '../_internal/assert.std.tsx';
import {
  concatIds,
  forwardExtraPropsForRadix,
} from '../_internal/props.dom.tsx';
import { tw } from '../tw.dom.tsx';

export namespace AriaLabelled {
  /**
   * Element id registration
   * --------------------------------------------------------------------------
   */

  type Ids = ReadonlyArray<string>;

  type Unregister = () => void;
  type Register = (element: Element | null) => Unregister;

  function toIds(elements: ReadonlyArray<Element>): Ids {
    return elements.map(element => element.id);
  }

  /**
   * Tracks the ids of rendered elements (via a ref callback) so they can be
   * referenced with `aria-labelledby`, `aria-describedby`, etc.
   *
   * Ids are kept in DOM order, since elements that mount later (like a
   * conditional description) can come before others in the DOM.
   */
  function useIds(): [Ids, Register] {
    const [ids, setIds] = useState<Ids>([]);
    const elementsRef = useRef<ReadonlyArray<Element>>([]);

    const register: Register = useCallback(element => {
      assert(element != null, 'must be rendered in react 19 or higher');
      assert(element.id !== '', 'element is missing id');

      const prev = elementsRef.current;
      const index = prev.findIndex(other => {
        const position = element.compareDocumentPosition(other);
        // oxlint-disable-next-line no-bitwise
        return (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      });
      const elements = prev.toSpliced(
        index === -1 ? prev.length : index,
        0,
        element
      );
      elementsRef.current = elements;
      setIds(toIds(elements));

      return () => {
        const remaining = elementsRef.current.filter(other => {
          return other !== element;
        });
        elementsRef.current = remaining;
        setIds(toIds(remaining));
      };
    }, []);

    return [ids, register];
  }

  type RegisterContextType = Readonly<{
    registerLabel: Register;
    registerDescription: Register;
    registerErrorMessage: Register;
  }>;

  const RegisterContext =
    createStrictContext<RegisterContextType>('AxoLabelled.Root');

  type IdsContextType = Readonly<{
    labels: Ids;
    descriptions: Ids;
    errorMessages: Ids;
  }>;

  const IdsContext = createStrictContext<IdsContextType>('AxoLabelled.Root');

  /**
   * <AriaLabelled.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    /**
     * Should contain a `Target`, and any `Label`, `Description`, and
     * `ErrorMessage` elements for it.
     */
    children: ReactNode;
  }>;

  /**
   * Collects the ids of `Label`, `Description`, and `ErrorMessage` elements
   * so that `Target` can reference them. Does not render an element.
   */
  export const Root: FC<RootProps> = memo(props => {
    const [labels, registerLabel] = useIds();
    const [descriptions, registerDescription] = useIds();
    const [errorMessages, registerErrorMessage] = useIds();

    const context = useMemo((): RegisterContextType => {
      return { registerLabel, registerDescription, registerErrorMessage };
    }, [registerLabel, registerDescription, registerErrorMessage]);

    const ids = useMemo((): IdsContextType => {
      return { labels, descriptions, errorMessages };
    }, [labels, descriptions, errorMessages]);

    return (
      <RegisterContext value={context}>
        <IdsContext value={ids}>{props.children}</IdsContext>
      </RegisterContext>
    );
  });

  Root.displayName = 'AriaLabelled.Root';

  /**
   * <AriaLabelled.Target>
   * --------------------------------------------------------------------------
   */

  export type TargetProps = Readonly<{
    asChild?: boolean;
    id?: string;
    label?: string;
    description?: string;
    children: ReactNode;
  }>;

  /** Passed by a parent with `asChild` (like a tooltip trigger) */
  type ParentAriaProps = Readonly<{
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
  }>;

  /**
   * The element that is labelled, described, and/or marked invalid by the
   * `Label`, `Description`, and `ErrorMessage` elements in the same `Root`.
   */
  export const Target: FC<TargetProps> = memo(
    (props: TargetProps & ParentAriaProps) => {
      const {
        asChild,
        id,
        label,
        description,
        children,
        'aria-labelledby': parentLabelledBy,
        'aria-describedby': parentDescribedBy,
        ...rest
      } = props;
      const Comp = asChild ? Slot.Root : 'div';
      const labelId = useId();
      const descriptionId = useId();

      const { labels, descriptions, errorMessages } =
        useStrictContext(IdsContext);

      const labelledBy = concatIds(...labels, parentLabelledBy);
      const describedBy = concatIds(
        ...errorMessages,
        ...descriptions,
        parentDescribedBy
      );
      const errorMessage = concatIds(...errorMessages);

      // `aria-labelledby` and `aria-describedby` take precedence over
      // `aria-label` and `aria-description`, so when both are used, the props
      // are rendered into hidden elements that can be referenced too.
      const hasHiddenLabel = label != null && labelledBy != null;
      const hasHiddenDescription = description != null && describedBy != null;

      const labelProps = useMemo(() => {
        // Only set attributes with values to avoid conflicts with `asChild`
        const result: HTMLAttributes<HTMLElement> = {};

        if (id != null) {
          result.id = id;
        }

        if (labelledBy != null) {
          result['aria-labelledby'] = hasHiddenLabel
            ? `${labelId} ${labelledBy}`
            : labelledBy;
        } else if (label != null) {
          result['aria-label'] = label;
        }

        if (describedBy != null) {
          result['aria-describedby'] = hasHiddenDescription
            ? `${descriptionId} ${describedBy}`
            : describedBy;
        } else if (description != null) {
          result['aria-description'] = description;
        }

        if (errorMessage != null) {
          result['aria-invalid'] = true;
          result['aria-errormessage'] = errorMessage;
        }

        return result;
      }, [
        id,
        label,
        description,
        labelId,
        descriptionId,
        labelledBy,
        describedBy,
        errorMessage,
        hasHiddenLabel,
        hasHiddenDescription,
      ]);

      return (
        <>
          <Comp {...forwardExtraPropsForRadix(rest)} {...labelProps}>
            {children}
          </Comp>
          {hasHiddenLabel && (
            <span id={labelId} className={tw('sr-only')}>
              {label}
            </span>
          )}
          {hasHiddenDescription && (
            <span id={descriptionId} className={tw('sr-only')}>
              {description}
            </span>
          )}
        </>
      );
    }
  );

  Target.displayName = 'AriaLabelled.Target';

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
    const { registerLabel } = useStrictContext(RegisterContext);
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
    const { registerDescription } = useStrictContext(RegisterContext);
    return (
      <Comp ref={registerDescription} id={props.id ?? fallbackId}>
        {props.children}
      </Comp>
    );
  });

  Description.displayName = 'AriaLabelled.Description';

  /**
   * <AriaLabelled.ErrorMessage>
   * --------------------------------------------------------------------------
   */

  export type ErrorMessageProps = Readonly<{
    asChild?: boolean;
    id?: string;
    children: ReactNode;
  }>;

  /**
   * Marks the `Target` as invalid while rendered, and describes it.
   */
  export const ErrorMessage: FC<ErrorMessageProps> = memo(props => {
    const Comp = props.asChild ? Slot.Root : 'div';
    const fallbackId = useId();
    const { registerErrorMessage } = useStrictContext(RegisterContext);
    return (
      <Comp ref={registerErrorMessage} id={props.id ?? fallbackId}>
        {props.children}
      </Comp>
    );
  });

  ErrorMessage.displayName = 'AriaLabelled.ErrorMessage';
}
