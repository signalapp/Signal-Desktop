// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { RefCallback } from 'react';
import { useMemo, useState } from 'react';
import { createStrictContext, useStrictContext } from './StrictContext.dom.tsx';

/** @internal */
type AriaLabellingContextType = Readonly<{
  labelRef: RefCallback<HTMLElement>;
  descriptionRef: RefCallback<HTMLElement>;
}>;

/** @internal */
const AriaLabellingContext = createStrictContext<AriaLabellingContextType>(
  'AriaLabellingContext.Provider'
);

export type CreateAriaLabellingContextResult = Readonly<{
  /** The labelling context to pass to `AriaLabellingProvider`. */
  context: AriaLabellingContextType;
  /** The `id` of the label element, once mounted. `undefined` if no label has been registered. */
  labelId: string | undefined;
  /** The `id` of the description element, once mounted. `undefined` if none has been registered. */
  descriptionId: string | undefined;
}>;

/**
 * Creates a labelling context that captures element IDs from nested label and
 * description refs. Use the returned `labelId`/`descriptionId` to wire up
 * `aria-labelledby`/`aria-describedby` on the containing widget.
 */
export function useCreateAriaLabellingContext(): CreateAriaLabellingContextResult {
  const [labelId, setLabelId] = useState<string | undefined>();
  const [descriptionId, setDescriptionId] = useState<string | undefined>();

  const context = useMemo((): AriaLabellingContextType => {
    function labelRef(element: HTMLElement | null) {
      setLabelId(element?.id);
    }

    function descriptionRef(element: HTMLElement | null) {
      setDescriptionId(element?.id);
    }

    return { labelRef, descriptionRef };
  }, []);

  return { context, labelId, descriptionId };
}

/** Context provider. Pass the `context` returned by `useCreateAriaLabellingContext`. */
export const AriaLabellingProvider = AriaLabellingContext.Provider;

/**
 * Reads the labelling context and returns `labelRef`/`descriptionRef` callbacks
 * for registering label and description elements. Must be called inside an
 * `AriaLabellingProvider`.
 */
export function useAriaLabellingContext(
  providerName: string
): AriaLabellingContextType {
  return useStrictContext(
    AriaLabellingContext,
    `Must be wrapped with a <${providerName}>`
  );
}
