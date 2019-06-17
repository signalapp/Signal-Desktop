import * as React from 'react';
import classNames from 'classnames';
import { getImagePath, SkinToneKey } from './lib';

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
      const image = getImagePath(shortName, skinTone);

      return (
        <div
          ref={ref}
          className={classNames(
            'module-emoji',
            `module-emoji--${size}px`,
            inline ? 'module-emoji--inline' : null,
            className
          )}
          style={style}
        >
          <img
            className={`module-emoji__image--${size}px`}
            src={image}
            alt={shortName}
          />
        </div>
      );
    }
  )
);
