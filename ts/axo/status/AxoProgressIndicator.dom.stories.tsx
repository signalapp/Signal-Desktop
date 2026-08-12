// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { useEffect, useId, useState } from 'react';
import type { Meta } from '@storybook/react';
import { AxoProgressIndicator } from './AxoProgressIndicator.dom.tsx';
import { tw } from '../tw.dom.tsx';
import { AxoMath } from '../_internal/AxoMath.dom.tsx';
import { AxoCheckbox } from '../AxoCheckbox.dom.tsx';

export default {
  title: 'Axo/Status/AxoProgressIndicator',
} satisfies Meta;

function useFakeProgress(): { total: number; completed: number } {
  const [completed, setCompleted] = useState(0);
  const total = 100;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current = 0;

    function set(value: number) {
      current = value;
      setCompleted(value);
    }

    function next() {
      if (current >= total) {
        // reset
        timer = setTimeout(() => {
          set(0);
          timer = setTimeout(() => {
            next();
          }, 500);
        }, 500);
        return;
      }

      const wait = AxoMath.pseudoRandomInt(100, 500);
      const increment = AxoMath.pseudoRandomInt(5, 20);

      timer = setTimeout(() => {
        set(AxoMath.clamp(current + increment, 0, total));
        next();
      }, wait);
    }

    next();

    return () => {
      clearTimeout(timer);
    };
  }, [total]);

  return { completed, total };
}

export function Basic(): ReactNode {
  const { total, completed } = useFakeProgress();
  return (
    <AxoProgressIndicator.Root size="md" total={total} completed={completed} />
  );
}

export function NoTrack(): ReactNode {
  const progress = useFakeProgress();
  return <AxoProgressIndicator.Root size="md" noTrack {...progress} />;
}

type CheckboxProps = Readonly<{
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}>;

function Checkbox(props: CheckboxProps) {
  const id = useId();

  return (
    <div className={tw('flex gap-2')}>
      <AxoCheckbox.Root
        id={id}
        variant="square"
        checked={props.checked}
        onCheckedChange={props.onCheckedChange}
      />
      <label htmlFor={id}>{props.label}</label>
    </div>
  );
}

export function Indeterminate(): ReactNode {
  const [completed, setCompleted] = useState(false);
  const [total, setTotal] = useState(true);

  return (
    <>
      <Checkbox
        checked={completed}
        onCheckedChange={setCompleted}
        label="Known completed amount"
      />
      <Checkbox
        checked={total}
        onCheckedChange={setTotal}
        label="Known total amount"
      />
      <AxoProgressIndicator.Root
        size="md"
        noTrack
        completed={completed ? 30 : 'indeterminate'}
        total={total ? 100 : 'indeterminate'}
      />
    </>
  );
}

export function Sizes(): ReactNode {
  const progress = useFakeProgress();
  return (
    <div className={tw('flex gap-2')}>
      <AxoProgressIndicator.Root size="sm" {...progress} />
      <AxoProgressIndicator.Root size="md" {...progress} />
      <AxoProgressIndicator.Root size="lg" {...progress} />
    </div>
  );
}

export function Weights(): ReactNode {
  const progress = useFakeProgress();
  return (
    <div className={tw('flex gap-2')}>
      <AxoProgressIndicator.Root size="md" weight="thin" {...progress} />
      <AxoProgressIndicator.Root size="md" weight="light" {...progress} />
      <AxoProgressIndicator.Root size="md" weight="regular" {...progress} />
      <AxoProgressIndicator.Root size="md" weight="medium" {...progress} />
    </div>
  );
}
