import React from 'react';

interface Props {
  /** The View class, which will be instantiated then treated like a Backbone View */
  readonly View: BackboneViewConstructor;
  /** Options to be passed along to the view when constructed */
  readonly options: object;
}

interface BackboneView {
  remove: () => void;
  render: () => void;
  el: HTMLElement;
}

interface BackboneViewConstructor {
  new (options: object): BackboneView;
}

/**
 * Allows Backbone Views to be rendered inside of React (primarily for the Style Guide)
 * while we slowly replace the internals of a given Backbone view with React.
 */
export class BackboneWrapper extends React.Component<Props> {
  protected el: HTMLElement | null = null;
  protected view: BackboneView | null = null;

  public componentWillUnmount() {
    this.teardown();
  }

  public shouldComponentUpdate() {
    // we're handling all updates manually
    return false;
  }

  public render() {
    return <div ref={this.setEl} />;
  }

  protected setEl = (element: HTMLDivElement | null) => {
    this.el = element;
    this.setup();
  };

  protected setup = () => {
    const { View, options } = this.props;

    if (!this.el) {
      return;
    }
    this.view = new View(options);
    this.view.render();

    // It's important to let the view create its own root DOM element. This ensures that
    //   its tagName property actually takes effect.
    this.el.appendChild(this.view.el);
  };

  protected teardown() {
    if (!this.view) {
      return;
    }

    this.view.remove();
    this.view = null;
  }
}
