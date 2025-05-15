// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom';

import { About } from '../../components/About';
import { i18n } from '../sandboxedInit';
import { strictAssert } from '../../util/assert';
import { FunDefaultEnglishEmojiLocalizationProvider } from '../../components/fun/FunEmojiLocalizationProvider';

const { AboutWindowProps } = window.Signal;

strictAssert(AboutWindowProps, 'window values not provided');

ReactDOM.render(
  <StrictMode>
    <FunDefaultEnglishEmojiLocalizationProvider>
      <About
        closeAbout={() => window.SignalContext.executeMenuRole('close')}
        appEnv={AboutWindowProps.appEnv}
        platform={AboutWindowProps.platform}
        arch={AboutWindowProps.arch}
        i18n={i18n}
        version={window.SignalContext.getVersion()}
      />
    </FunDefaultEnglishEmojiLocalizationProvider>
  </StrictMode>,
  document.getElementById('app')
);
