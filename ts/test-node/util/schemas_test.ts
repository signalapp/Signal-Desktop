// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import assert from 'node:assert/strict';
import {
  parseLoose,
  parsePartial,
  parseStrict,
  parseUnknown,
  SchemaParseError,
} from '../../util/schemas';

describe('schemas', () => {
  const schema = z.object({ prop: z.literal('value') });

  it('rejects invalid inputs', () => {
    function assertThrows(fn: () => void) {
      assert.throws(fn, SchemaParseError);
    }

    const input = { prop: 42 };
    // @ts-expect-error: not unknown
    assertThrows(() => parseUnknown(schema, input));
    // @ts-expect-error: invalid type
    assertThrows(() => parseStrict(schema, input));
    assertThrows(() => parseLoose(schema, input));
    // @ts-expect-error: invalid type
    assertThrows(() => parsePartial(schema, input));
  });

  it('accepts valid inputs', () => {
    const valid = { prop: 'value' };

    function assertShape(value: { prop: 'value' }) {
      assert.deepEqual(value, valid);
    }

    // unknown
    {
      const input = valid as unknown;
      assertShape(parseUnknown(schema, input));
      // @ts-expect-error: not strict
      assertShape(parseStrict(schema, input));
      // @ts-expect-error: not loose
      assertShape(parseLoose(schema, input));
      // @ts-expect-error: not partial
      assertShape(parsePartial(schema, input));
    }
    // any
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = valid as unknown as any;
      // @ts-expect-error: not unknown
      assertShape(parseUnknown(schema, input));
      // @ts-expect-error: not strict
      assertShape(parseStrict(schema, input));
      // @ts-expect-error: not loose
      assertShape(parseLoose(schema, input));
      // @ts-expect-error: not partial
      assertShape(parsePartial(schema, input));
    }
    // {}
    {
      // eslint-disable-next-line @typescript-eslint/ban-types
      const input = valid as unknown as {};
      // @ts-expect-error: not unknown
      assertShape(parseUnknown(schema, input));
      // @ts-expect-error: not strict
      assertShape(parseStrict(schema, input));
      // @ts-expect-error: not loose
      assertShape(parseLoose(schema, input));
      // @ts-expect-error: not partial
      assertShape(parsePartial(schema, input));
    }
    // never
    {
      const input = valid as unknown as never;
      // @ts-expect-error: not unknown
      assertShape(parseUnknown(schema, input));
      // @ts-expect-error: not strict
      assertShape(parseStrict(schema, input));
      // @ts-expect-error: not loose
      assertShape(parseLoose(schema, input));
      // @ts-expect-error: not partial
      assertShape(parsePartial(schema, input));
    }
    // { prop: "value" }
    {
      const input = valid as { prop: 'value' };
      // @ts-expect-error: not unknown
      assertShape(parseUnknown(schema, input));
      assertShape(parseStrict(schema, input));
      assertShape(parseLoose(schema, input));
      assertShape(parsePartial(schema, input));
    }
    // { prop?: "value" }
    {
      const input = valid as { prop?: 'value' };
      // @ts-expect-error: not unknown
      assertShape(parseUnknown(schema, input));
      // @ts-expect-error: not strict
      assertShape(parseStrict(schema, input));
      // @ts-expect-error: not loose
      assertShape(parseLoose(schema, input));
      assertShape(parsePartial(schema, input));
    }
    // { prop: "value" | void }
    {
      const input = valid as { prop: 'value' | void };
      // @ts-expect-error: not unknown
      assertShape(parseUnknown(schema, input));
      // @ts-expect-error: not strict
      assertShape(parseStrict(schema, input));
      assertShape(parseLoose(schema, input));
      assertShape(parsePartial(schema, input));
    }
    // { prop: "value" | undefined }
    {
      const input = valid as { prop: 'value' | undefined };
      // @ts-expect-error: not unknown
      assertShape(parseUnknown(schema, input));
      // @ts-expect-error: not strict
      assertShape(parseStrict(schema, input));
      assertShape(parseLoose(schema, input));
      assertShape(parsePartial(schema, input));
    }
    // { prop: "value" | null }
    {
      const input = valid as { prop: 'value' | null };
      // @ts-expect-error: not unknown
      assertShape(parseUnknown(schema, input));
      // @ts-expect-error: not strict
      assertShape(parseStrict(schema, input));
      assertShape(parseLoose(schema, input));
      assertShape(parsePartial(schema, input));
    }

    // { prop: string }
    {
      const input = valid as { prop: string };
      // @ts-expect-error: not unknown
      assertShape(parseUnknown(schema, input));
      // @ts-expect-error: not strict
      assertShape(parseStrict(schema, input));
      assertShape(parseLoose(schema, input));
      // @ts-expect-error: not partial
      assertShape(parsePartial(schema, input));
    }
    // { prop?: string }
    {
      const input = valid as { prop?: string };
      // @ts-expect-error: not unknown
      assertShape(parseUnknown(schema, input));
      // @ts-expect-error: not strict
      assertShape(parseStrict(schema, input));
      // @ts-expect-error: not loose
      assertShape(parseLoose(schema, input));
      // @ts-expect-error: not partial
      assertShape(parsePartial(schema, input));
    }
    // { prop: void }
    {
      const input = valid as unknown as { prop: void };
      // @ts-expect-error: not unknown
      assertShape(parseUnknown(schema, input));
      // @ts-expect-error: not strict
      assertShape(parseStrict(schema, input));
      assertShape(parseLoose(schema, input));
      assertShape(parsePartial(schema, input));
    }
    // { prop: undefined }
    {
      const input = valid as unknown as { prop: undefined };
      // @ts-expect-error: not unknown
      assertShape(parseUnknown(schema, input));
      // @ts-expect-error: not strict
      assertShape(parseStrict(schema, input));
      assertShape(parseLoose(schema, input));
      assertShape(parsePartial(schema, input));
    }
    // { prop: null }
    {
      const input = valid as unknown as { prop: null };
      // @ts-expect-error: not unknown
      assertShape(parseUnknown(schema, input));
      // @ts-expect-error: not strict
      assertShape(parseStrict(schema, input));
      assertShape(parseLoose(schema, input));
      assertShape(parsePartial(schema, input));
    }
    // { prop: unknown }
    {
      const input = valid as { prop: unknown };
      // @ts-expect-error: not unknown
      assertShape(parseUnknown(schema, input));
      // @ts-expect-error: not strict
      assertShape(parseStrict(schema, input));
      assertShape(parseLoose(schema, input));
      // @ts-expect-error: not partial
      assertShape(parsePartial(schema, input));
    }
    // { prop: any }
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = valid as { prop: any };
      // @ts-expect-error: not unknown
      assertShape(parseUnknown(schema, input));
      // (ideally not allowed)
      assertShape(parseStrict(schema, input));
      // (ideally not allowed)
      assertShape(parseLoose(schema, input));
      // (ideally not allowed)
      assertShape(parsePartial(schema, input));
    }
    // { prop: {} }
    {
      // eslint-disable-next-line @typescript-eslint/ban-types
      const input = valid as { prop: {} };
      // @ts-expect-error: not unknown
      assertShape(parseUnknown(schema, input));
      // @ts-expect-error: not strict
      assertShape(parseStrict(schema, input));
      // (ideally not allowed)
      assertShape(parseLoose(schema, input));
      // @ts-expect-error: not partial
      assertShape(parsePartial(schema, input));
    }
    // { prop: never }
    {
      const input = valid as { prop: never };
      // @ts-expect-error: not unknown
      assertShape(parseUnknown(schema, input));
      // (ideally not allowed)
      assertShape(parseStrict(schema, input));
      // (ideally not allowed)
      assertShape(parseLoose(schema, input));
      // (ideally not allowed)
      assertShape(parsePartial(schema, input));
    }
  });
});
