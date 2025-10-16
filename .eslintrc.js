// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// For reference: https://github.com/airbnb/javascript

const rules = {
  'comma-dangle': [
    'error',
    {
      arrays: 'always-multiline',
      objects: 'always-multiline',
      imports: 'always-multiline',
      exports: 'always-multiline',
      functions: 'never',
    },
  ],

  // No omitting braces, keep on the same line
  'brace-style': ['error', '1tbs', { allowSingleLine: false }],
  curly: ['error', 'all'],

  // Immer support
  'no-param-reassign': [
    'error',
    {
      props: true,
      ignorePropertyModificationsForRegex: ['^draft'],
      ignorePropertyModificationsFor: ['acc', 'ctx', 'context'],
    },
  ],

  // Always use === and !== except when directly comparing to null
  // (which only will equal null or undefined)
  eqeqeq: ['error', 'always', { null: 'never' }],

  // prevents us from accidentally checking in exclusive tests (`.only`):
  'mocha/no-exclusive-tests': 'error',

  // encourage consistent use of `async` / `await` instead of `then`
  'more/no-then': 'error',

  // it helps readability to put public API at top,
  'no-use-before-define': 'off',
  '@typescript-eslint/no-use-before-define': 'off',

  // useful for unused or internal fields
  'no-underscore-dangle': 'off',

  // Temp: We have because TypeScript's `allowUnreachableCode` option is on.
  'no-unreachable': 'error',

  // though we have a logger, we still remap console to log to disk
  'no-console': 'error',

  // consistently place operators at end of line except ternaries
  'operator-linebreak': [
    'error',
    'after',
    { overrides: { '?': 'ignore', ':': 'ignore' } },
  ],

  quotes: [
    'error',
    'single',
    { avoidEscape: true, allowTemplateLiterals: false },
  ],

  'no-continue': 'off',
  'lines-between-class-members': 'off',
  'class-methods-use-this': 'off',

  // Prettier overrides:
  'arrow-parens': 'off',
  'function-paren-newline': 'off',
  'max-len': [
    'error',
    {
      // Prettier generally limits line length to 80 but sometimes goes over.
      // The `max-len` plugin doesn’t let us omit `code` so we set it to a
      // high value as a buffer to let Prettier control the line length:
      code: 999,
      // We still want to limit comments as before:
      comments: 90,
      ignoreUrls: true,
    },
  ],

  'react/jsx-props-no-spreading': 'off',

  // Updated to reflect future airbnb standard
  // Allows for declaring defaultProps inside a class
  'react/static-property-placement': ['error', 'static public field'],

  // JIRA: DESKTOP-657
  'react/sort-comp': 'off',

  // We don't have control over the media we're sharing, so can't require
  // captions.
  'jsx-a11y/media-has-caption': 'off',

  // We prefer named exports
  'import/prefer-default-export': 'off',
  'import/enforce-node-protocol-usage': ['error', 'always'],
  'import/extensions': [
    'error',
    'ignorePackages',
    {
      checkTypeImports: true,
    },
  ],

  // Prefer functional components with default params
  'react/require-default-props': 'off',

  // Empty fragments are used in adapters between models and react views.
  'react/jsx-no-useless-fragment': [
    'error',
    {
      allowExpressions: true,
    },
  ],

  // Our code base has tons of arrow functions passed directly to components.
  'react/jsx-no-bind': 'off',

  // Does not support forwardRef
  'react/no-unused-prop-types': 'off',

  // Not useful for us as we have lots of complicated types.
  'react/destructuring-assignment': 'off',

  'react/function-component-definition': [
    'error',
    {
      namedComponents: 'function-declaration',
      unnamedComponents: 'arrow-function',
    },
  ],

  'react/display-name': 'error',

  'react/jsx-pascal-case': ['error', { allowNamespace: true }],

  // Allow returning values from promise executors for brevity.
  'no-promise-executor-return': 'off',

  // Redux ducks use this a lot
  'default-param-last': 'off',

  'jsx-a11y/label-has-associated-control': ['error', { assert: 'either' }],

  'jsx-a11y/no-static-element-interactions': 'error',

  '@typescript-eslint/no-non-null-assertion': ['error'],
  '@typescript-eslint/no-empty-interface': ['error'],
  'no-empty-function': 'off',
  '@typescript-eslint/no-empty-function': 'error',

  'no-restricted-syntax': [
    'error',
    {
      selector: 'TSInterfaceDeclaration',
      message:
        'Prefer `type`. Interfaces are mutable and less powerful, so we prefer `type` for simplicity.',
    },
    // Defaults
    {
      selector: 'ForInStatement',
      message:
        'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
    },
    {
      selector: 'LabeledStatement',
      message:
        'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
    },
    {
      selector: 'WithStatement',
      message:
        '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
    },
  ],

  'react-hooks/exhaustive-deps': [
    'error',
    {
      additionalHooks: '^(useSpring|useSprings)$',
    },
  ],
  'local-rules/license-comments': 'error',
};

const typescriptRules = {
  ...rules,

  'local-rules/file-suffix': 'error',

  // Override brace style to enable typescript-specific syntax
  'brace-style': 'off',
  '@typescript-eslint/brace-style': [
    'error',
    '1tbs',
    { allowSingleLine: false },
  ],

  '@typescript-eslint/array-type': ['error', { default: 'generic' }],

  'no-restricted-imports': 'off',
  '@typescript-eslint/no-restricted-imports': [
    'error',
    {
      paths: [
        {
          name: 'chai',
          importNames: ['expect', 'should', 'Should'],
          message: 'Please use assert',
          allowTypeImports: true,
        },
      ],
    },
  ],

  // Overrides recommended by typescript-eslint
  //   https://github.com/typescript-eslint/typescript-eslint/releases/tag/v4.0.0
  '@typescript-eslint/no-redeclare': 'error',
  '@typescript-eslint/no-shadow': 'error',
  '@typescript-eslint/no-useless-constructor': ['error'],
  '@typescript-eslint/no-misused-promises': [
    'error',
    {
      checksVoidReturn: false,
    },
  ],

  '@typescript-eslint/no-floating-promises': 'error',
  // We allow "void promise", but new call-sites should use `drop(promise)`.
  'no-void': ['error', { allowAsStatement: true }],

  'no-shadow': 'off',
  'no-useless-constructor': 'off',

  // useful for unused parameters
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

  // Upgrade from a warning
  '@typescript-eslint/explicit-module-boundary-types': 'error',

  '@typescript-eslint/consistent-type-imports': 'error',

  // Future: Maybe switch to never and always use `satisfies`
  '@typescript-eslint/consistent-type-assertions': [
    'error',
    {
      assertionStyle: 'as',
      // Future: Maybe switch to allow-as-parameter or never
      objectLiteralTypeAssertions: 'allow',
    },
  ],

  // Already enforced by TypeScript
  'consistent-return': 'off',

  // TODO: DESKTOP-4655
  'import/no-cycle': 'off',
  'import/no-restricted-paths': [
    'error',
    {
      zones: [
        {
          target: ['ts/util', 'ts/types'],
          from: ['ts/components', 'ts/axo'],
          message: 'Importing components is forbidden from ts/{util,types}',
        },
      ],
    },
  ],
};

const TAILWIND_REPLACEMENTS = [
  // inset
  { pattern: 'left-*', fix: 'start-*' },
  { pattern: 'right-*', fix: 'end-*' },
  // margin
  { pattern: 'ml-*', fix: 'ms-*' },
  { pattern: 'mr-*', fix: 'me-*' },
  // padding
  { pattern: 'pl-*', fix: 'ps-*' },
  { pattern: 'pr-*', fix: 'pe-*' },
  // border
  { pattern: 'border-l-*', fix: 'border-s-*' },
  { pattern: 'border-r-*', fix: 'border-e-*' },
  // border-radius
  { pattern: 'rounded-l', fix: 'rounded-s' },
  { pattern: 'rounded-r', fix: 'rounded-e' },
  { pattern: 'rounded-tl', fix: 'rounded-ss' },
  { pattern: 'rounded-tr', fix: 'rounded-se' },
  { pattern: 'rounded-bl', fix: 'rounded-es' },
  { pattern: 'rounded-br', fix: 'rounded-ee' },
  { pattern: 'rounded-l-*', fix: 'rounded-s-*' },
  { pattern: 'rounded-r-*', fix: 'rounded-e-*' },
  { pattern: 'rounded-tl-*', fix: 'rounded-ss-*' },
  { pattern: 'rounded-tr-*', fix: 'rounded-se-*' },
  { pattern: 'rounded-bl-*', fix: 'rounded-es-*' },
  { pattern: 'rounded-br-*', fix: 'rounded-ee-*' },
  // text-align
  { pattern: 'text-left', fix: 'text-start' },
  { pattern: 'text-right', fix: 'text-end' },
  // float
  { pattern: 'float-left', fix: 'float-start' },
  { pattern: 'float-right', fix: 'float-end' },
  // clear
  { pattern: 'clear-left', fix: 'clear-start' },
  { pattern: 'clear-right', fix: 'clear-end' },
];

module.exports = {
  root: true,
  settings: {
    react: {
      version: 'detect',
    },
    'import/core-modules': ['electron'],
  },

  extends: ['airbnb-base', 'prettier'],

  plugins: ['mocha', 'more', 'local-rules'],

  overrides: [
    {
      files: [
        'ts/**/*.ts',
        'ts/**/*.tsx',
        'app/**/*.ts',
        'build/intl-linter/**/*.ts',
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: 'tsconfig.json',
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 2018,
        sourceType: 'module',
      },
      plugins: ['@typescript-eslint'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:react/recommended',
        'airbnb-typescript-prettier',
      ],
      rules: typescriptRules,
    },
    {
      files: [
        '**/*.stories.tsx',
        'ts/build/**',
        'ts/test-*/**',
        'build/intl-linter/**/*.ts',
      ],
      rules: {
        ...typescriptRules,
        'import/no-extraneous-dependencies': 'off',
        'react/no-array-index-key': 'off',
      },
    },
    {
      files: ['ts/state/ducks/**/*.ts'],
      rules: {
        'local-rules/type-alias-readonlydeep': 'error',
      },
    },
    {
      files: ['ts/**/*_test.*.{ts,tsx}'],
      rules: {
        'func-names': 'off',
      },
    },
    {
      files: ['ts/**/*.tsx'],
      plugins: ['better-tailwindcss'],
      settings: {
        'better-tailwindcss': {
          entryPoint: './stylesheets/tailwind-config.css',
          callees: ['tw'],
          attributes: [],
          variables: [],
        },
      },
      rules: {
        'local-rules/enforce-tw': 'error',

        // stylistic: Enforce consistent line wrapping for tailwind classes. (recommended, autofix)
        'better-tailwindcss/enforce-consistent-line-wrapping': 'off',
        // stylistic: Enforce a consistent order for tailwind classes. (recommended, autofix)
        'better-tailwindcss/enforce-consistent-class-order': 'error',
        // stylistic: Enforce consistent variable syntax. (autofix)
        'better-tailwindcss/enforce-consistent-variable-syntax': 'error',
        // stylistic: Enforce consistent position of the important modifier. (autofix)
        'better-tailwindcss/enforce-consistent-important-position': 'error',
        // stylistic: Enforce shorthand class names. (autofix)
        'better-tailwindcss/enforce-shorthand-classes': 'error',
        // stylistic: Remove duplicate classes. (autofix)
        'better-tailwindcss/no-duplicate-classes': 'error',
        // stylistic: Remove deprecated classes. (autofix)
        'better-tailwindcss/no-deprecated-classes': 'off',
        // stylistic: Disallow unnecessary whitespace in tailwind classes. (autofix)
        'better-tailwindcss/no-unnecessary-whitespace': 'error',
        // correctness: Report classes not registered with tailwindcss. (recommended)
        'better-tailwindcss/no-unregistered-classes': 'error',
        // correctness: Report classes that produce conflicting styles.
        'better-tailwindcss/no-conflicting-classes': 'error',
        // correctness: Disallow restricted classes. (autofix)
        'better-tailwindcss/no-restricted-classes': [
          'error',
          {
            restrict: [
              {
                pattern: '\\[#[a-fA-F0-9]{3,8}?\\]', // ex: "text-[#fff]"
                message: 'No arbitrary hex values',
              },
              {
                pattern: '\\[rgba?\\(.*\\)\\]', // ex: "text-[rgb(255,255,255)]"
                message: 'No arbitrary rgb values',
              },
              {
                pattern: '\\[hsla?\\(.*\\)\\]', // ex: "text-[hsl(255,255,255)]"
                message: 'No arbitrary hsl values',
              },
              {
                pattern: '^.*!$', // ex: "p-4!"
                message: 'No !important modifiers',
              },
              {
                pattern: '^\\*+:.*', // ex: "*:mx-0",
                message: 'No child variants',
              },
              ...TAILWIND_REPLACEMENTS.map(item => {
                const pattern = item.pattern.replace('*', '(.*)');
                const fix = item.fix.replace('*', '$2');
                return {
                  message: `Use logical property ${item.fix} instead of ${item.pattern}`,
                  pattern: `^(.*:)?${pattern}$`,
                  fix: `$1${fix}`,
                };
              }),
            ],
          },
        ],
      },
    },
    {
      files: ['ts/axo/**/*.tsx'],
      rules: {
        '@typescript-eslint/no-namespace': 'off',
        '@typescript-eslint/no-redeclare': [
          'error',
          {
            ignoreDeclarationMerge: true,
          },
        ],
        '@typescript-eslint/explicit-module-boundary-types': [
          'error',
          {
            allowHigherOrderFunctions: false,
          },
        ],
      },
    },
  ],

  rules: {
    ...rules,
    'import/no-unresolved': 'off',
    'import/extensions': 'off',
  },

  reportUnusedDisableDirectives: true,
};
