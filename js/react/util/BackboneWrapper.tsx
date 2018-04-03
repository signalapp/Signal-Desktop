import React from 'react';

interface IProps {
  /** The View class, which will be instantiated then treated like a Backbone View */
  readonly View: IBackboneViewConstructor;
  /** Options to be passed along to the view when constructed */
  readonly options: object;
}

interface IBackboneView {
  remove: () => void;
  render: () => void;
  el: HTMLElement;
}

interface IBackboneViewConstructor {
    new (options: object): IBackboneView;
}

/**
 * Allows Backbone Views to be rendered inside of React (primarily for the styleguide)
 * while we slowly replace the internals of a given Backbone view with React.
 */
export class BackboneWrapper extends React.Component<IProps, {}> {
  protected el: Element | null;
  protected view: IBackboneView | null;
  protected setEl: (element: HTMLDivElement | null) => void;

  constructor(props: IProps) {
    super(props);

    this.el = null;
    this.view = null;

    this.setEl = (element: HTMLDivElement | null) => {
      this.el = element;
      this.setup();
    };
    this.setup = this.setup.bind(this);
  }

  public setup() {
    const { el } = this;
    const { View, options } = this.props;

    if (!el) {
      return;
    }
    this.view = new View(options);
    this.view.render();

    // It's important to let the view create its own root DOM element. This ensures that
    //   its tagName property actually takes effect.
    el.appendChild(this.view.el);
  }

  public teardown() {
    if (!this.view) {
      return;
    }

    this.view.remove();
    this.view = null;
  }

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
}
