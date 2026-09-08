// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createRoot } from 'react-dom/client';

import '../sandboxedInit.dom.ts';
import { Pdf } from '../../components/Pdf.dom.tsx';
import { strictAssert } from '../../util/assert.std.ts';
import { AppProvider } from '../AppProvider.dom.tsx';
import { AxoTheme } from '../../axo/AxoTheme.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { setDocumentLocale } from '../../util/setDocumentLocale.dom.ts';

const { PDFWindowProps } = window.Signal;
const { i18n } = window.SignalContext;

setDocumentLocale(document);

strictAssert(PDFWindowProps, 'window values not provided');

const app = document.getElementById('app');
strictAssert(app != null, 'No #app');

createRoot(app).render(
  <AppProvider>
    <AxoTheme.Override theme="force-light">
      <div className={tw('text-primary')}>
        <Pdf i18n={i18n} {...PDFWindowProps} />
      </div>
    </AxoTheme.Override>
  </AppProvider>
);
