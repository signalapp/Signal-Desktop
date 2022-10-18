// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export type PromiseAction<Type extends string, Payload = void, Meta = void> =
  | ({
      type: Type;
      payload: Promise<Payload>;
    } & (Meta extends void
      ? { meta?: void }
      : {
          meta: Meta;
        }))
  | {
      type: `${Type}_PENDING`;
      meta: Meta;
    }
  | {
      type: `${Type}_FULFILLED`;
      payload: Payload;
      meta: Meta;
    }
  | {
      type: `${Type}_REJECTED`;
      error: true;
      payload: Error;
      meta: Meta;
    };
