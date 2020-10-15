import React from 'react';
import classNames from 'classnames';
import { ColorType } from '../types/Colors';

export type PropsType = {
  avatarPath?: string;
  children: React.ReactNode;
  color?: ColorType;
};

export const CallBackgroundBlur = ({
  avatarPath,
  children,
  color,
}: PropsType): JSX.Element => {
  const backgroundProps = avatarPath
    ? {
        style: {
          backgroundImage: `url("${avatarPath}")`,
        },
      }
    : {
        className: classNames(
          'module-calling__background',
          `module-background-color__${color || 'default'}`
        ),
      };

  return (
    <div className="module-calling__background">
      <div className="module-calling__background--blur" {...backgroundProps} />
      {children}
    </div>
  );
};
