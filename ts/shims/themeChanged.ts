// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getThemeType } from '../util/getThemeType';

export async function themeChanged(): Promise<void> {
  if (window.reduxActions && window.reduxActions.user) {
    const theme = await getThemeType();
    window.reduxActions.user.userChanged({ theme });
  }
}
