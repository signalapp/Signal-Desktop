// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Line, Rule } from 'endanger';

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function has<T extends object, const K extends T[any]>(
  value: T,
  key: K
): value is T & Record<K, T[K]> {
  return Object.hasOwn(value, key);
}

export default function migrateBackboneToRedux() {
  return new Rule({
    match: {
      files: ['pnpm-lock.yaml'],
    },
    messages: {
      missingIntegrity: `
        **Dependency resolution missing integrity**
        All dependencies should have a resolution with an integrity field.
        You may need to override it or provide it manually.

				See "{name}".
			`,
    },
    async run({ files, context }) {
      for (const file of files.modifiedOrCreated) {
        const contents: unknown = await file.yaml();

        assert(
          isObject(contents) &&
            has(contents, 'packages') &&
            isObject(contents.packages),
          'pnpm.yaml should be object'
        );

        for (const [name, spec] of Object.entries(contents.packages)) {
          assert(
            isObject(spec) &&
              has(spec, 'resolution') &&
              isObject(spec.resolution),
            `${name} spec should be object`
          );

          if (!has(spec.resolution, 'integrity')) {
            context.fail('missingIntegrity', { file }, { name });
          }
        }
      }
    },
  });
}
