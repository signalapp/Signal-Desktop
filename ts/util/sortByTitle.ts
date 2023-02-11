// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

type HasTitle = {
  title: string;
};

export function sortByTitle<T extends HasTitle>(
  arr: ReadonlyArray<T>
): Array<T> {
  return [...arr].sort((a, b) => a.title.localeCompare(b.title));
}
