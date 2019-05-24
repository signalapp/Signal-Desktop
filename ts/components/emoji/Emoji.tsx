import * as React from 'react';
import classNames from 'classnames';
import { getSheetCoordinates, SkinToneKey } from './lib';

export type OwnProps = {
  inline?: boolean;
  shortName: string;
  skinTone?: SkinToneKey | number;
  size?: 16 | 20 | 28 | 32 | 64 | 66;
};

export type Props = OwnProps &
  Pick<React.HTMLProps<HTMLDivElement>, 'style' | 'className'>;

export const Emoji = React.memo(
  React.forwardRef<HTMLDivElement, Props>(
    (
      { style = {}, size = 28, shortName, skinTone, inline, className }: Props,
      ref
    ) => {
      const [sheetX, sheetY] = getSheetCoordinates(shortName, skinTone);
      const x = -(size * sheetX);
      const y = -(size * sheetY);

      return (
        <div
          ref={ref}
          className={classNames(
            'module-emoji',
            `module-emoji--${size}px`,
            inline ? 'module-emoji--inline' : null,
            className
          )}
          style={{
            ...style,
            backgroundPositionX: `${x}px`,
            backgroundPositionY: `${y}px`,
          }}
        />
      );
    }
  )
);
