import * as React from 'react';
import classNames from 'classnames';
import { getImagePath, SkinToneKey } from './lib';

export type OwnProps = {
  inline?: boolean;
  shortName: string;
  skinTone?: SkinToneKey | number;
  size?: 16 | 18 | 20 | 28 | 32 | 64 | 66;
  children?: React.ReactNode;
};

export type Props = OwnProps &
  Pick<React.HTMLProps<HTMLDivElement>, 'style' | 'className'>;

export const Emoji = React.memo(
  React.forwardRef<HTMLDivElement, Props>(
    (
      {
        style = {},
        size = 28,
        shortName,
        skinTone,
        inline,
        className,
        children,
      }: Props,
      ref
    ) => {
      const image = getImagePath(shortName, skinTone);
      const backgroundStyle = inline
        ? { backgroundImage: `url('${image}')` }
        : {};

      return (
        <span
          ref={ref}
          className={classNames(
            'module-emoji',
            `module-emoji--${size}px`,
            inline ? `module-emoji--${size}px--inline` : null,
            className
          )}
          style={{ ...style, ...backgroundStyle }}
        >
          {inline ? (
            // When using this component as a draft.js decorator it is very
            // important that these children are the only elements to render
            children
          ) : (
            <img
              className={`module-emoji__image--${size}px`}
              src={image}
              alt={shortName}
            />
          )}
        </span>
      );
    }
  )
);
