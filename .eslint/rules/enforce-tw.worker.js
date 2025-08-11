// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
const { runAsWorker } = require('synckit');
const enhancedResolve = require('enhanced-resolve');
const tailwind = require('tailwindcss');
const path = require('node:path');
const fs = require('node:fs');

const rootDir = path.join(__dirname, '../..');
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
      loadStylesheet(id, base) {
        const resolved = resolver(base, id);
        if (!resolved) {
          return { base: '', content: '' };
        }
        return {
          base: path.dirname(resolved),
          content: fs.readFileSync(resolved, 'utf-8'),
        };
      },
    }
  );

  return designSystem;
}

let cachedDesignSystem = null;

runAsWorker(async classNames => {
  cachedDesignSystem ??= await loadDesignSystem();
  const designSystem = cachedDesignSystem;
  const css = designSystem.candidatesToCss(classNames);
  const tailwindClassNames = classNames.filter((_, index) => {
    return css.at(index) !== null;
  });
  return tailwindClassNames;
});
