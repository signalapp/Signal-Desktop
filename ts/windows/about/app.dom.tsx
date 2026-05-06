// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createRoot } from 'react-dom/client';

import '../sandboxedInit.dom.ts';
import { About } from '../../components/About.dom.tsx';
import { strictAssert } from '../../util/assert.std.ts';
import { AppProvider } from '../AppProvider.dom.tsx';

const { AboutWindowProps } = window.Signal;
const { i18n } = window.SignalContext;

strictAssert(AboutWindowProps, 'window values not provided');

const app = document.getElementById('app');
strictAssert(app != null, 'No #app');

createRoot(app).render(
  <AppProvider>
    <About
      closeAbout={() => window.SignalContext.executeMenuRole('close')}
      appEnv={AboutWindowProps.appEnv}
      platform={AboutWindowProps.platform}
      arch={AboutWindowProps.arch}
      i18n={i18n}
      version={window.SignalContext.getVersion()}
    />
  </AppProvider>
);
