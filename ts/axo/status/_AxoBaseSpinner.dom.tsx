// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC, SVGProps } from 'react';
import { memo, useMemo } from 'react';
import { tw } from '../tw.dom.tsx';
import { variants } from '../_internal/variants.dom.tsx';
import { AxoMath } from '../_internal/AxoMath.dom.tsx';

export namespace AxoBaseSpinner {
  /**
   * Preset sizes for standalone spinners, the base spinner can be customized
   * to any size, but we should primarily use that internally in Axo components.
   */
  export type Size = 'sm' | 'md' | 'lg';

  /**
   * The stroke width of the spinner.
   * TODO: We might automate this based on size.
   */
  export type Weight = 'medium' | 'regular' | 'light' | 'thin';

  /**
   * The color variants
   */
  export type Variant = 'default' | 'oncolor';

  const Sizes = variants<Size, number>('AxoBaseSpinner.Size', {
    sm: 16,
    md: 24,
    lg: 36,
  });

  const Weights = variants<Weight, number>('AxoBaseSpinner.Weight', {
    medium: 2,
    regular: 1.8,
    light: 1.5,
    thin: 1.2,
  });

  const TrackVariants = variants<Variant>('AxoBaseSpinner.Variant', {
    default: tw('stroke-(--axo-color-fill-secondary)'),
    oncolor: tw('stroke-(--axo-color-label-disabled-oncolor)'),
  });

  const ProgressVariants = variants<Variant>('AxoBaseSpinner.Variant', {
    default: tw('stroke-(--axo-color-label-primary)'),
    oncolor: tw('stroke-(--axo-color-label-primary-oncolor)'),
  });

  export type ProgressValue = Readonly<{
    completed: number;
    total: number;
  }>;

  export type IndeterminateValue = 'indeterminate';

  export type Value = ProgressValue | IndeterminateValue;

  export type RootProps = Readonly<{
    size: Size | number;
    weight: Weight;
    variant: Variant;
    value: Value;
    track: boolean;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const { value } = props;

    const size =
      typeof props.size === 'number' ? props.size : Sizes.get(props.size);
    const strokeWidth = Weights.get(props.weight);
    const center = size / 2;
    const radius = size / 2 - strokeWidth / 2;

    const svgProps = useMemo((): SVGProps<SVGSVGElement> => {
      if (value === 'indeterminate') {
        return {
          role: 'progressbar',
          // without aria-valuenow/etc this is indeterminate
        };
      }

      return {
        role: 'progressbar',
        'aria-valuenow': value.completed,
        'aria-valuemin': 0,
        'aria-valuemax': value.total,
      };
    }, [value]);

    const progressProps = useMemo((): SVGProps<SVGCircleElement> => {
      if (value === 'indeterminate') {
        return {
          className: tw('animate-axo-spinner-dash'),
        };
      }

      const circumference = AxoMath.circumference(radius);
      const progress = AxoMath.progress(value.completed, 0, value.total);

      return {
        className: tw(
          'transition-[stroke-dashoffset] duration-500 ease-out-cubic'
        ),
        // setting the strokeDashArray to be the circumference of the ring
        // means each dash will cover the whole ring
        strokeDasharray: circumference,
        // offsetting the dash as a fraction of the circumference allows
        // showing the progress
        strokeDashoffset: (1 - progress) * circumference,
      };
    }, [value, radius]);

    return (
      <svg
        {...svgProps}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Track is only allowed for progress values */}
        {value !== 'indeterminate' && props.track && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            className={TrackVariants.get(props.variant)}
            strokeWidth={strokeWidth}
          />
        )}
        <g
          className={tw(
            'origin-center',
            value === 'indeterminate'
              ? 'animate-axo-spinner-rotate'
              : '-rotate-90'
          )}
        >
          <circle
            {...progressProps}
            className={tw(
              ProgressVariants.get(props.variant),
              'fill-none',
              progressProps.className
            )}
            cx={center}
            cy={center}
            r={radius}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
          />
        </g>
      </svg>
    );
  });

  Root.displayName = 'AxoBaseSpinner.Root';
}
