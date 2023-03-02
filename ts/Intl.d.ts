// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// https://github.com/microsoft/TypeScript/issues/29129
declare namespace Intl {
  function getCanonicalLocales(locales: string | Array<string>): Array<string>;
}
