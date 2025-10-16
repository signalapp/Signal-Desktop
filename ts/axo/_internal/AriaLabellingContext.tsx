// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { RefCallback } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import { assert } from './assert.dom.js';

type AriaLabellingContextType = Readonly<{
  labelRef: RefCallback<HTMLElement>;
  descriptionRef: RefCallback<HTMLElement>;
}>;

const AriaLabellingContext = createContext<AriaLabellingContextType | null>(
  null
);

export type CreateAriaLabellingContextResult = Readonly<{
  context: AriaLabellingContextType;
  labelId: string | undefined;
  descriptionId: string | undefined;
}>;

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

export const AriaLabellingProvider = AriaLabellingContext.Provider;

export function useAriaLabellingContext(
  componentName: string,
  providerName: string
): AriaLabellingContextType {
  return assert(
    useContext(AriaLabellingContext),
    `${componentName} must be wrapped with a ${providerName}`
  );
}
