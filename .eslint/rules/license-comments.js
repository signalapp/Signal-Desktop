// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
const COMMENT_LINE_1_EXACT = /^ Copyright \d{4} Signal Messenger, LLC$/;
const COMMENT_LINE_2_EXACT = /^ SPDX-License-Identifier: AGPL-3.0-only$/;

const COMMENT_LINE_1_LOOSE = /Copyright (\d{4}) Signal Messenger, LLC/;
const COMMENT_LINE_2_LOOSE = /SPDX-License-Identifier: AGPL-3.0-only/;

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    hasSuggestions: false,
    fixable: true,
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        let comment1 = node.comments.at(0);
        let comment2 = node.comments.at(1);

        if (
          comment1?.type === 'Line' &&
          comment2?.type === 'Line' &&
          COMMENT_LINE_1_EXACT.test(comment1.value) &&
          COMMENT_LINE_2_EXACT.test(comment2.value)
        ) {
          return;
        }

        context.report({
          node,
          message: 'Missing license comment',

          fix(fixer) {
            let year = null;
            let remove = [];

            for (let comment of node.comments) {
              let match1 = comment.value.match(COMMENT_LINE_1_LOOSE);
              let match2 = comment.value.match(COMMENT_LINE_2_LOOSE);

              if (match1 != null) {
                year = match1[1];
              }

              if (match1 != null || match2 != null) {
                remove.push(comment);
              }
            }

            year ??= new Date().getFullYear().toString();

            let insert =
              `// Copyright ${year} Signal Messenger, LLC\n` +
              '// SPDX-License-Identifier: AGPL-3.0-only\n';

            return [
              fixer.replaceTextRange([0, 0], insert),
              ...remove.map(comment => {
                return fixer.replaceTextRange(
                  [comment.range[0], comment.range[1]],
                  ''
                );
              }),
            ];
          },
        });
      },
    };
  },
};
