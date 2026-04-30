// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps, JSX } from 'react';

import { SmartReactionPicker } from './ReactionPicker.dom.tsx';

export const renderReactionPicker = (
  props: ComponentProps<typeof SmartReactionPicker>
): JSX.Element => <SmartReactionPicker {...props} />;
