// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Line, Rule } from 'endanger';

export default function migrateBackboneToRedux() {
  return new Rule({
    match: {
      files: ['**/*.{js,jsx,ts,tsx}'],
    },
    messages: {
      foundNewBackboneFile: `
				**Prefer Redux**
				Don't create new Backbone files, use Redux
			`,
      foundBackboneFileWithManyChanges: `
				**Prefer Redux**
				Migrate Backbone files to Redux when making major changes
			`,
    },
    async run({ files, context }) {
      for (let file of files.modifiedOrCreated) {
        let lines = await file.lines();
        let matchedLine: Line | null = null;

        for (let line of lines) {
          // Check for the most stable part of the backbone `import`
          if (
            (await line.contains("from 'backbone'")) ||
            (await line.contains('window.Backbone'))
          ) {
            matchedLine = line;
            break;
          }
        }

        if (!matchedLine) {
          continue;
        }

        if (file.created) {
          context.warn('foundNewBackboneFile', { file, line: matchedLine });
        } else if (file.modifiedOnly) {
          if (await file.diff().changedBy({ added: 0.1 })) {
            context.warn('foundBackboneFileWithManyChanges', {
              file,
              line: matchedLine,
            });
          }
        }
      }
    },
  });
}
