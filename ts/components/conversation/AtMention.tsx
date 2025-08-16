// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import classNames from 'classnames';
import type { KeyboardEventHandler } from 'react';
import React from 'react';
import { Emojify } from './Emojify';

export function AtMention({
  direction,
  id,
  isInvisible,
  isStrikethrough,
  name,
  onClick,
  onKeyUp,
}: {
  direction: 'incoming' | 'outgoing' | undefined;
  id: string;
  isInvisible: boolean;
  isStrikethrough?: boolean;
  name: string;
  onClick: () => void;
  onKeyUp: KeyboardEventHandler;
}): JSX.Element {
  const textElement = (
    <>
      @
      <Emojify isInvisible={isInvisible} text={name} />
    </>
  );
  const formattedTextElement = isStrikethrough ? (
    <s>{textElement}</s>
  ) : (
    textElement
  );

  if (isInvisible) {
    return (
      <span
        className={classNames(
          'MessageBody__at-mention',
          'MessageBody__at-mention--invisible'
        )}
        data-id={id}
        data-title={name}
      >
        <bdi>{formattedTextElement}</bdi>
      </span>
    );
  }

  return (
    <span
      className={classNames(
        'MessageBody__at-mention',
        `MessageBody__at-mention--${direction}`
      )}
      onClick={onClick}
      onKeyUp={onKeyUp}
      tabIndex={0}
      role="link"
      data-id={id}
      data-title={name}
    >
      <bdi>{formattedTextElement}</bdi>
    </span>
  );
}
