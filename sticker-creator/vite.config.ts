// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
    },
  },
  worker: {
    format: 'es',
  },
  plugins: [react(), visualizer()],
  server: {
    proxy: {
      '/api/socket': {
        secure: true,
        target: 'wss://create.staging.signal.art',
        changeOrigin: true,
        headers: {
          origin: 'https://create.staging.signal.art',
        },
      },
      '/api': {
        secure: true,
        target: 'https://create.staging.signal.art',
        changeOrigin: true,
      },
    },
  },
});
