// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import * as ReactDOM from 'react-dom';
import * as Backbone from 'backbone';

export class ReactWrapperView extends Backbone.View {
  private readonly onClose?: () => unknown;
  private JSX: ReactElement;

  constructor({
    className,
    onClose,
    JSX,
  }: Readonly<{
    className?: string;
    onClose?: () => unknown;
    JSX: ReactElement;
  }>) {
    super();

    this.className = className ?? 'react-wrapper';
    this.JSX = JSX;
    this.onClose = onClose;

    this.render();
  }

  update(JSX: ReactElement): void {
    this.JSX = JSX;
    this.render();
  }

  override render(): this {
    this.el.className = this.className;
    ReactDOM.render(this.JSX, this.el);
    return this;
  }

  override remove(): this {
    if (this.onClose) {
      this.onClose();
    }
    ReactDOM.unmountComponentAtNode(this.el);
    Backbone.View.prototype.remove.call(this);
    return this;
  }
}
