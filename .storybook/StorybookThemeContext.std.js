// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createContext } from 'react';
import { ThemeType } from '../ts/types/Util.std.js';

export const StorybookThemeContext = createContext(ThemeType.light);
