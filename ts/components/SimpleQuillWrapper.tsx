// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { createRef } from 'react';
import Quill from '@signalapp/quill-cjs';
import Emitter from '@signalapp/quill-cjs/core/emitter';
import type { Delta } from '@signalapp/quill-cjs';

export type Props = {
  className: string;
  defaultValue: Delta | undefined;
  formats: Array<string>;
  modules: Record<string, unknown>;
  onChange?(): void;
  placeholder: string;
  readOnly: boolean | undefined;
};

export class SimpleQuillWrapper extends React.Component<Props> {
  quill: Quill | undefined;
  quillElement = createRef<HTMLDivElement>();

  override shouldComponentUpdate(): boolean {
    return false;
  }

  override componentDidMount(): void {
    this.createQuill();

    if (!this.quill) {
      throw new Error(
        'SimpleQuillWrapper.componentDidMount: this.quill not set!'
      );
    }

    this.quill.on(Emitter.events.EDITOR_CHANGE, this.props.onChange);

    const { defaultValue } = this.props;
    if (defaultValue) {
      this.quill.setContents(defaultValue);
    }
  }

  override componentWillUnmount(): void {
    if (!this.quill) {
      return;
    }

    this.quill.off('editor-change', this.props.onChange);
    this.quill = undefined;
  }

  createQuill(): void {
    if (this.quill) {
      throw new Error('createQuill: this.quill already set!');
    }
    if (!this.quillElement?.current) {
      throw new Error('createQuill: this.quillElement is not set!');
    }

    this.quill = new Quill(this.quillElement.current, {
      formats: this.props.formats,
      modules: this.props.modules,
      placeholder: this.props.placeholder,
      readOnly: this.props.readOnly,
    });
  }

  // eslint-disable-next-line react/no-unused-class-component-methods
  public getQuill(): Quill | undefined {
    return this.quill;
  }

  override render(): JSX.Element {
    return (
      <div className={`quill ${this.props.className}`}>
        <div ref={this.quillElement} />
      </div>
    );
  }
}
