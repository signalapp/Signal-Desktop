// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../sandboxedInit.js';
import { About } from '../../components/About.js';
import { strictAssert } from '../../util/assert.js';
import { FunDefaultEnglishEmojiLocalizationProvider } from '../../components/fun/FunEmojiLocalizationProvider.js';
import { AxoProvider } from '../../axo/AxoProvider.js';

const { AboutWindowProps } = window.Signal;
const { i18n } = window.SignalContext;

strictAssert(AboutWindowProps, 'window values not provided');

const app = document.getElementById('app');
strictAssert(app != null, 'No #app');

createRoot(app).render(
  <StrictMode>
    <AxoProvider
      dir={window.SignalContext.getResolvedMessagesLocaleDirection()}
    >
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
    </AxoProvider>
  </StrictMode>
);
