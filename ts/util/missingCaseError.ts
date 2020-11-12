// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const stringify = (value: unknown): string => {
  try {
    // `JSON.stringify` can return `undefined` (TypeScript has incorrect types here).
    //   However, this is fine because we interpolate it into a string, so it shows up as
    //   "undefined" in the final error message.
    return JSON.stringify(value);
  } catch (err) {
    return Object.prototype.toString.call(value);
  }
};

// `missingCaseError` is useful for compile-time checking that all `case`s in
// a `switch` statement have been handled, e.g.
//
// type AttachmentType = 'media' | 'documents';
//
// const type: AttachmentType = selectedTab;
// switch (type) {
//   case 'media':
//     return <MediaGridItem/>;
//   case 'documents':
//     return <DocumentListItem/>;
//   default:
//     return missingCaseError(type);
// }
//
// If we extended `AttachmentType` to `'media' | 'documents' | 'links'` the code
// above would trigger a compiler error stating that `'links'` has not been
// handled by our `switch` / `case` statement which is useful for code
// maintenance and system evolution.
export const missingCaseError = (x: never): TypeError =>
  new TypeError(`Unhandled case: ${stringify(x)}`);
