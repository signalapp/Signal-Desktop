// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { runAsWorker } from 'synckit';
import enhancedResolve from 'enhanced-resolve';
import * as tailwind from 'tailwindcss';
import path from 'node:path';
import fs from 'node:fs';

const rootDir = path.join(import.meta.dirname, '../..');
const tailwindCssPath = path.join(rootDir, 'stylesheets/tailwind-config.css');

async function loadDesignSystem() {
  const tailwindCss = fs.readFileSync(tailwindCssPath, 'utf-8');
  const resolver = enhancedResolve.create.sync({
    conditionNames: ['style'],
    extensions: ['.css'],
    mainFields: ['style'],
  });

  const designSystem = await tailwind.__unstable__loadDesignSystem(
    tailwindCss,
    {
      base: path.dirname(tailwindCssPath),
      async loadStylesheet(id, base) {
        const resolved = resolver(base, id);
        if (!resolved) {
          return { path: '', base: '', content: '' };
        }
        return {
          path: resolved,
          base: path.dirname(resolved),
          content: fs.readFileSync(resolved, 'utf-8'),
        };
      },
    }
  );

  return designSystem;
}

let cachedDesignSystem = null;

/**
 * @param {Array<string>} classNames
 */
async function worker(classNames) {
  cachedDesignSystem ??= await loadDesignSystem();
  const designSystem = cachedDesignSystem;
  const css = designSystem.candidatesToCss(classNames);
  const tailwindClassNames = classNames.filter((_, index) => {
    return css.at(index) != null;
  });
  return tailwindClassNames;
}

runAsWorker(worker);
