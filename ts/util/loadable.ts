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
    }
  | { loadingState: LoadingState.Loaded; value: ValueT }
  | { loadingState: LoadingState.LoadFailed; error: ErrorT };
