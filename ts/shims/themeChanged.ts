// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getThemeType } from '../util/getThemeType';

export function themeChanged(): void {
  if (window.reduxActions && window.reduxActions.user) {
    const theme = getThemeType();
    window.reduxActions.user.userChanged({ theme });
  }
}
