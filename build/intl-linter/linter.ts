// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { parse as parseIcuMessage } from '@formatjs/icu-messageformat-parser';
import type {
  MessageFormatElement,
  Location,
} from '@formatjs/icu-messageformat-parser';
import parseJsonToAst from 'json-to-ast';
import { readFile } from 'fs/promises';
import { join as pathJoin, relative as pathRelative } from 'path';
import chalk from 'chalk';
import { deepEqual } from 'assert';
import type { Rule } from './utils/rule';

import icuPrefix from './rules/icuPrefix';
import onePlural from './rules/onePlural';
import noLegacyVariables from './rules/noLegacyVariables';
import noNestedChoice from './rules/noNestedChoice';
import noOffset from './rules/noOffset';
import noOrdinal from './rules/noOrdinal';

const RULES = [
  icuPrefix,
  noLegacyVariables,
  noNestedChoice,
  noOffset,
  noOrdinal,
  onePlural,
];

type Test = {
  messageformat: string;
  expectErrors: Array<string>;
};

const tests: Record<string, Test> = {
  'icu:err1': {
    messageformat: '{a, plural, other {a}} {b, plural, other {b}}',
    expectErrors: ['onePlural'],
  },
  'icu:err2': {
    messageformat: '{a, plural, other {{b, plural, other {b}}}}',
    expectErrors: ['noNestedChoice', 'onePlural'],
  },
  'icu:err3': {
    messageformat: '{a, select, other {{b, select, other {b}}}}',
    expectErrors: ['noNestedChoice'],
  },
  'icu:err4': {
    messageformat: '{a, plural, offset:1 other {a}}',
    expectErrors: ['noOffset'],
  },
  'icu:err5': {
    messageformat: '{a, selectordinal, other {a}}',
    expectErrors: ['noOrdinal'],
  },
  'icu:err6': {
    messageformat: '$a$',
    expectErrors: ['noLegacyVariables'],
  },
};

type Report = {
  id: string;
  message: string;
  location: Location | void;
};

function lintMessage(
  messageId: string,
  elements: Array<MessageFormatElement>,
  rules: Array<Rule>
) {
  const reports: Array<Report> = [];
  for (const rule of rules) {
    rule.run(elements, {
      messageId,
      report(message, location) {
        reports.push({ id: rule.id, message, location });
      },
    });
  }
  return reports;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function lintMessages() {
  const repoRoot = pathJoin(__dirname, '..', '..');
  const filePath = pathJoin(repoRoot, '_locales/en/messages.json');
  const relativePath = pathRelative(repoRoot, filePath);
  let file = await readFile(filePath, 'utf-8');

  if (process.argv.includes('--test')) {
    file = JSON.stringify(tests);
  }

  const jsonAst = parseJsonToAst(file);

  assert(jsonAst.type === 'Object', 'Expected an object');
  for (const topProp of jsonAst.children) {
    if (topProp.key.value === 'smartling') {
      continue;
    }

    const messageId = topProp.key.value;

    assert(topProp.value.type === 'Object', 'Expected an object');

    const icuMessageProp = topProp.value.children.find(messageProp => {
      return messageProp.key.value === 'messageformat';
    });
    if (icuMessageProp == null) {
      continue;
    }

    const icuMesssageLiteral = icuMessageProp.value;
    assert(
      icuMesssageLiteral.type === 'Literal' &&
        typeof icuMesssageLiteral.value === 'string',
      'Expected a string'
    );

    const icuMessage: string = icuMesssageLiteral.value;

    const ast = parseIcuMessage(icuMessage, {
      captureLocation: true,
      shouldParseSkeletons: true,
      requiresOtherClause: true,
    });

    const reports = lintMessage(messageId, ast, RULES);
    const key = topProp.key.value;

    if (process.argv.includes('--test')) {
      const test = tests[key];
      const actualErrors = reports.map(report => report.id);
      deepEqual(actualErrors, test.expectErrors);
      continue;
    }

    for (const report of reports) {
      let loc = '';

      if (report.location != null && icuMesssageLiteral.loc != null) {
        const line =
          icuMesssageLiteral.loc.start.line + (report.location.start.line - 1);
        const column =
          icuMesssageLiteral.loc.start.column + report.location.start.column;
        loc = `:${line}:${column}`;
      } else if (icuMesssageLiteral.loc != null) {
        const { line, column } = icuMesssageLiteral.loc.start;
        loc = `:${line}:${column}`;
      }

      // eslint-disable-next-line no-console
      console.error(
        chalk`{bold.cyan ${relativePath}${loc}} ${report.message} {magenta ({underline ${report.id}})}`
      );
      // eslint-disable-next-line no-console
      console.error(chalk`  {dim in ${key} is "}{red ${icuMessage}}{dim "}`);
      // eslint-disable-next-line no-console
      console.error();
    }
  }
}

lintMessages().catch(error => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
