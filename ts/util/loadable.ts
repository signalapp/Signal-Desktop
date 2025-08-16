// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export enum LoadingState {
  Loading,
  Loaded,
  LoadFailed,
}

export type Loadable<ValueT, ErrorT = unknown> =
  | {
      loadingState: LoadingState.Loading;
      value?: never;
      error?: never;
    }
  | { loadingState: LoadingState.Loaded; value: ValueT; error?: never }
  | { loadingState: LoadingState.LoadFailed; value?: never; error: ErrorT };
