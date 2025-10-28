// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps } from 'react';
import React from 'react';

import { SmartReactionPicker } from './ReactionPicker.dom.js';

export const renderReactionPicker = (
  props: ComponentProps<typeof SmartReactionPicker>
): JSX.Element => <SmartReactionPicker {...props} />;
