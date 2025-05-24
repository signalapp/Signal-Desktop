// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export enum SqliteErrorKind {
  Corrupted = 'Corrupted',
  Readonly = 'Readonly',
  Logic = 'Logic',
  Unknown = 'Unknown',
}

export function parseSqliteError(error?: Error): SqliteErrorKind {
  const message = error?.message;
  if (!message) {
    return SqliteErrorKind.Unknown;
  }

  if (
    message.includes('SQLITE_CORRUPT') ||
    message.includes('database disk image is malformed') ||
    message.includes('file is not a database')
  ) {
    return SqliteErrorKind.Corrupted;
  }

  if (
    message.includes('SQLITE_READONLY') ||
    message.includes('attempt to write a readonly database')
  ) {
    return SqliteErrorKind.Readonly;
  }

  if (message.includes('SQL logic error')) {
    return SqliteErrorKind.Logic;
  }

  return SqliteErrorKind.Unknown;
}
