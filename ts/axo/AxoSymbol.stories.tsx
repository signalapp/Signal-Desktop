// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useMemo, useState } from 'react';
import type { Meta } from '@storybook/react';
import { Direction } from 'radix-ui';
import Fuse from 'fuse.js';
import { AxoSymbol } from './AxoSymbol.dom.js';
import { tw } from './tw.dom.js';
import {
  _getAllAxoSymbolInlineGlyphNames,
  getAxoSymbolInlineGlyph,
} from './_internal/AxoSymbolDefs.generated.std.js';

export default {
  title: 'Axo/AxoSymbol',
} satisfies Meta;

const allAxoSymbolNames = _getAllAxoSymbolInlineGlyphNames()
  .slice()
  .sort((a, b) => a.localeCompare(b));
const fuse = new Fuse(allAxoSymbolNames);

const SymbolInfo = memo(function SymbolInfo(props: {
  symbolName: AxoSymbol.InlineGlyphName;
}): JSX.Element {
  const ltr = getAxoSymbolInlineGlyph(props.symbolName, 'ltr');
  const rtl = getAxoSymbolInlineGlyph(props.symbolName, 'rtl');

  type Variant = { title: string; dir: 'ltr' | 'rtl'; text: string };

  const variants: ReadonlyArray<Variant> =
    ltr === rtl
      ? [
          // same
          { title: 'LTR/RTL', dir: 'ltr', text: ltr },
        ]
      : [
          { title: 'LTR', dir: 'ltr', text: ltr },
          { title: 'RTL', dir: 'rtl', text: rtl },
        ];

  return (
    <figure
      className={tw(
        'flex flex-col items-center gap-2 border border-border-primary bg-background-secondary p-4'
      )}
    >
      <div className={tw('flex w-full flex-1 flex-row justify-between')}>
        {variants.map(variant => {
          return (
            <div className={tw('flex flex-1 flex-col items-center gap-2')}>
              <span className={tw('type-caption text-label-secondary')}>
                {variant.title}
              </span>
              <span className={tw('text-[20px] leading-none')}>
                <Direction.Provider dir={variant.dir}>
                  <AxoSymbol.InlineGlyph
                    symbol={props.symbolName}
                    label={null}
                  />
                </Direction.Provider>
              </span>
              <code className={tw('type-caption text-label-secondary')}>
                {Array.from(variant.text, char => {
                  const codePoint = char.codePointAt(0) ?? -1;
                  return `U+${codePoint.toString(16).toUpperCase()}`;
                }).join(' ')}
              </code>
            </div>
          );
        })}
      </div>
      <figcaption
        className={tw(
          'w-full truncate border-t border-dotted border-border-primary pt-4 text-center type-body-medium text-color-label-primary'
        )}
      >
        <code>{props.symbolName}</code>
      </figcaption>
    </figure>
  );
});

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
      <div
        className={tw(
          'sticky top-4 mb-3 bg-elevated-background-primary p-4 shadow-elevation-2'
        )}
      >
        <input
          type="search"
          value={input}
          placeholder="Search..."
          onChange={event => {
            setInput(event.currentTarget.value);
          }}
          className={tw(
            'w-full rounded bg-elevated-background-secondary p-3 type-body-medium'
          )}
        />
      </div>
      <div
        className={tw(
          'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
        )}
      >
        {results.map(result => {
          return <SymbolInfo key={result} symbolName={result} />;
        })}
      </div>
    </>
  );
}
