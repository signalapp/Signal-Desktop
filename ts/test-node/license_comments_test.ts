// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// This file is meant to be run frequently, so it doesn't check the license year. See the
// imported `license_comments` file for a job that does this, to be run on CI.

import { assert } from 'chai';

import {
  forEachRelevantFile,
  getExtension,
  readFirstLines,
} from '../util/lint/license_comments';

describe('license comments', () => {
  it('includes a license comment at the top of every relevant file', async function test() {
    // This usually executes quickly but can be slow in some cases, such as Windows CI.
    this.timeout(10000);

    await forEachRelevantFile(async file => {
      let firstLine: string;
      let secondLine: string;

      if (getExtension(file) === '.sh') {
        const firstThreeLines = await readFirstLines(file, 3);
        [, firstLine, secondLine] = firstThreeLines;
      } else {
        [firstLine, secondLine] = await readFirstLines(file, 2);
      }

      if (!firstLine || !secondLine) {
        throw new Error(`file ${file}: was missing a first or second line!`);
      }

      const { groups = {} } =
        firstLine.match(
          /Copyright (?<startYearWithDash>\d{4}-)?(?<endYearString>\d{4}) Signal Messenger, LLC/
        ) || [];
      const { startYearWithDash, endYearString } = groups;
      const endYear = Number(endYearString);

      // We added these comments in 2020.
      assert.isAtLeast(
        endYear,
        2020,
        `First line of ${file} is missing correct license header comment`
      );

      if (startYearWithDash) {
        const startYear = Number(startYearWithDash.slice(0, -1));
        assert.isBelow(
          startYear,
          endYear,
          `Starting license year of ${file} is not below the ending year`
        );
      }

      assert.include(
        secondLine,
        'SPDX-License-Identifier: AGPL-3.0-only',
        `Second line of ${file} is missing correct license header comment`
      );
    });
  });
});
