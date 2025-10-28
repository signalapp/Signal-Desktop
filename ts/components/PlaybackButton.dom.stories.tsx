// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useContext } from 'react';
import type { CSSProperties } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { ButtonProps } from './PlaybackButton.dom.js';
import { PlaybackButton } from './PlaybackButton.dom.js';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext.std.js';
import { ThemeType } from '../types/Util.std.js';
import { AUDIO_MP3 } from '../types/MIME.std.js';

export default {
  title: 'components/PlaybackButton',
  component: PlaybackButton,
} satisfies Meta<ButtonProps>;

const rowStyles: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  padding: 10,
};

export function Default(): JSX.Element {
  const theme = useContext(StorybookThemeContext);
  const themeIncomingColor = theme === ThemeType.light ? '#e9e9e9' : '#3b3b3b';

  return (
    <>
      {(['message', 'draft', 'mini'] as const).map(variant => (
        <>
          {(['incoming', 'outgoing'] as const).map(context => (
            <div
              style={{
                ...rowStyles,
                background:
                  context === 'outgoing' ? '#2c6bed' : themeIncomingColor,
              }}
            >
              {(
                [
                  'play',
                  'pause',
                  'not-downloaded',
                  'downloading',
                  'computing',
                ] as const
              ).map(mod => (
                <PlaybackButton
                  key={`${variant}_${context}_${mod}`}
                  variant={variant}
                  label="playback"
                  attachment={
                    mod === 'downloading'
                      ? undefined
                      : {
                          contentType: AUDIO_MP3,
                          size: 3000,
                          totalDownloaded: 1000,
                          isPermanentlyUndownloadable: false,
                        }
                  }
                  onClick={action('click')}
                  context={context}
                  mod={mod}
                />
              ))}
            </div>
          ))}
        </>
      ))}
    </>
  );
}
