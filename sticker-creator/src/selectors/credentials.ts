// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useSelector } from 'react-redux';

import type { RootState } from '../store';
import type { Credentials } from '../types.d';

export const useCredentials = (): Credentials | undefined =>
  useSelector(({ credentials }: RootState) => credentials.credentials);
