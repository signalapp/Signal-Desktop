// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as sass from 'sass';

// https://vitejs.dev/config/
export default defineConfig({
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
    preprocessorOptions: {
      scss: {
        // setting the version number is not working for some reason
        fatalDeprecations: Object.values(sass.deprecations)
          .filter(dep => dep.status !== 'obsolete')
          .map(dep => dep.id),
      },
    },
  },
  worker: {
    format: 'es',
  },
  plugins: [react()],
});
