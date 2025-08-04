// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useMemo, useState } from 'react';
import type { Meta } from '@storybook/react';
import { Direction } from 'radix-ui';
import Fuse from 'fuse.js';
import type { AxoSymbolName } from './AxoSymbol';
import { AxoSymbol, _getAllAxoSymbolNames, _getAxoSymbol } from './AxoSymbol';

export default {
  title: 'Axo/AxoSymbol',
} satisfies Meta;

const SymbolInfo = memo(function SymbolInfo(props: {
  symbolName: AxoSymbolName;
}): JSX.Element {
  const ltr = _getAxoSymbol(props.symbolName, 'ltr');
  const rtl = _getAxoSymbol(props.symbolName, 'rtl');

  const variants =
    ltr === rtl
      ? ([
          // same
          { title: 'LTR/RTL', dir: 'ltr', text: ltr },
        ] as const)
      : ([
          { title: 'LTR', dir: 'ltr', text: ltr },
          { title: 'RTL', dir: 'rtl', text: rtl },
        ] as const);

  return (
    <figure className="flex flex-col items-center gap-2 border border-border-primary bg-background-secondary p-4">
      <div className="flex w-full flex-1 flex-row justify-between">
        {variants.map(variant => {
          return (
            <div className="flex flex-1 flex-col items-center gap-2">
              <span className="type-caption text-label-secondary">
                {variant.title}
              </span>
              <span className="text-[20px] leading-none">
                <Direction.DirectionProvider dir={variant.dir}>
                  <AxoSymbol.InlineGlyph
                    symbol={props.symbolName}
                    label={null}
                  />
                </Direction.DirectionProvider>
              </span>
              <code className="type-caption text-label-secondary">
                {Array.from(variant.text, char => {
                  const codePoint = char.codePointAt(0) ?? -1;
                  return `U+${codePoint.toString(16).toUpperCase()}`;
                }).join(' ')}
              </code>
            </div>
          );
        })}
      </div>
      <figcaption className="w-full truncate border-t border-dotted border-border-primary pt-4 text-center type-body-medium text-color-label-primary">
        <code>{props.symbolName}</code>
      </figcaption>
    </figure>
  );
});

const allAxoSymbolNames = _getAllAxoSymbolNames()
  .slice()
  .sort((a, b) => a.localeCompare(b));
const fuse = new Fuse(allAxoSymbolNames);

export function All(): JSX.Element {
  const [input, setInput] = useState('');

  const results = useMemo(() => {
    if (input.trim() !== '') {
      return fuse.search(input).map(result => {
        return result.item;
      });
    }
    return allAxoSymbolNames;
  }, [input]);

  return (
    <>
      <div className="sticky top-4 mb-3 bg-elevated-background-primary p-4 shadow-elevation-2">
        <input
          type="search"
          value={input}
          placeholder="Search..."
          onChange={event => {
            setInput(event.currentTarget.value);
          }}
          className="w-full rounded bg-elevated-background-secondary p-3 type-body-medium"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {results.map(result => {
          return <SymbolInfo key={result} symbolName={result} />;
        })}
      </div>
    </>
  );
}
