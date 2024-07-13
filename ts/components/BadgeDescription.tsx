// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild, ReactElement } from 'react';
import React from 'react';
import { ContactName } from './conversation/ContactName';

export type Props = Readonly<{
  firstName?: string;
  template: string;
  title: string;
}>;

export function BadgeDescription({
  firstName,
  template,
  title,
}: Props): ReactElement {
  const result: Array<ReactChild> = [];

  let lastIndex = 0;

  const matches = template.matchAll(/\{short_name\}/g);
  for (const match of matches) {
    const matchIndex = match.index || 0;

    result.push(template.slice(lastIndex, matchIndex));

    result.push(
      <ContactName
        key={matchIndex}
        firstName={firstName}
        title={title}
        preferFirstName
      />
    );

    lastIndex = matchIndex + 12;
  }

  result.push(template.slice(lastIndex));

  return <>{result}</>;
}
