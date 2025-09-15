// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { About } from '../../components/About';
import { i18n } from '../sandboxedInit';
import { strictAssert } from '../../util/assert';
import { FunDefaultEnglishEmojiLocalizationProvider } from '../../components/fun/FunEmojiLocalizationProvider';
import { AxoProvider } from '../../axo/AxoProvider';

const { AboutWindowProps } = window.Signal;

strictAssert(AboutWindowProps, 'window values not provided');

const app = document.getElementById('app');
strictAssert(app != null, 'No #app');

createRoot(app).render(
  <StrictMode>
    <AxoProvider dir={i18n.getLocaleDirection()}>
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
