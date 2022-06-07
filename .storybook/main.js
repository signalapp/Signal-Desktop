// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

module.exports = {
  stories: [
    '../ts/components/**/*.stories.tsx',
    '../sticker-creator/**/*.stories.tsx',
  ],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-actions',
    '@storybook/addon-controls',
    '@storybook/addon-measure',
    '@storybook/addon-toolbars',
    '@storybook/addon-viewport',
  ],
};
