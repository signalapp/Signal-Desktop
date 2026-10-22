// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Dialog, Tabs as RadixTabs } from 'radix-ui';
import type {
  CSSProperties,
  FC,
  MouseEvent,
  ReactNode,
  Ref,
  RefCallback,
} from 'react';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from 'motion/react';
import type { Transition } from 'motion/react';
import { AxoBaseDialog } from './_internal/AxoBaseDialog.dom.tsx';
import { AxoBaseLayer } from './_internal/AxoBaseLayer.dom.tsx';
import type { AxoSymbol } from './AxoSymbol.dom.tsx';
import { tw } from './tw.dom.tsx';
import { AxoScrollArea } from './AxoScrollArea.dom.tsx';
import { AxoButton } from './AxoButton.dom.tsx';
import { AxoIconButton } from './AxoIconButton.dom.tsx';
import { AxoTooltip } from './AxoTooltip.dom.tsx';
import { useAxoIntl } from './_internal/AxoIntl.dom.tsx';
import { variants } from './_internal/variants.dom.tsx';
import { assert, unreachable } from './_internal/assert.std.tsx';
import {
  createStrictContext,
  useStrictContext,
  useStrictContextNullable,
} from './_internal/StrictContext.dom.tsx';
import { forwardExtraPropsForRadix } from './_internal/props.dom.tsx';
import { mergeRefs } from '@react-aria/utils';
import { FlexWrapDetector } from './_internal/FlexWrapDetector.dom.tsx';
import { ExperimentalAxoBaseSegmentedControl } from './_internal/AxoBaseSegmentedControl.dom.tsx';

const {
  useContentEscapeBehavior,
  useContentRestoreFocusBehavior,
  useTriggerPresenceRef,
} = AxoBaseDialog;

/**
 * A window overlaid on either the primary window or another dialog window,
 * rendering the content underneath inert.
 *
 * @example Anatomy
 * ```tsx
 * <AxoDialog.Root>
 *   <AxoDialog.Trigger />
 *   <AxoDialog.Content>
 *     <AxoDialog.Header>
 *       <AxoDialog.Back />
 *       <AxoDialog.Title />
 *       <AxoDialog.Close />
 *     </AxoDialog.Header>
 *     <AxoDialog.Search>
 *       <AxoSearchField.Root>...</AxoSearchField.Root>
 *     </AxoDialog.Search>
 *     <AxoDialog.Body>
 *       <AxoDialog.Description />
 *     </AxoDialog.Body>
 *     <AxoDialog.Footer>
 *       <AxoDialog.FooterContent />
 *       <AxoDialog.Actions>
 *         <AxoDialog.Action/>
 *         <AxoDialog.Action/>
 *       </AxoDialog.Actions>
 *     </AxoDialog.Footer>
 *   </AxoDialog.Content>
 * </AxoDialog.Root>
 * ```
 *
 * @example Anatomy with tabs
 * ```tsx
 * <AxoDialog.Root>
 *   <AxoDialog.Content>
 *     <AxoDialog.Header>
 *       <AxoDialog.Title />
 *       <AxoDialog.Close />
 *     </AxoDialog.Header>
 *     <AxoDialog.Tabs>
 *       <AxoDialog.TabList>
 *         <AxoDialog.Tab />
 *         <AxoDialog.Tab />
 *       </AxoDialog.TabList>
 *       <AxoDialog.TabContent>
 *         <AxoDialog.Body />
 *       </AxoDialog.TabContent>
 *       <AxoDialog.TabContent>
 *         <AxoDialog.Body />
 *       </AxoDialog.TabContent>
 *     </AxoDialog.Tabs>
 *     <AxoDialog.Footer />
 *   </AxoDialog.Content>
 * </AxoDialog.Root>
 * ```
 *
 * @see {@link https://www.radix-ui.com/primitives/docs/components/dialog | Dialog - Radix Docs}
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ | Dialog (Modal) Pattern - ARIA Authoring Practices Guide}
 * @see {@link https://w3c.github.io/aria/#dialog | `dialog` role - WAI-ARIA 1.3}
 */
export namespace AxoDialog {
  /**
   * <AxoDialog.Root>
   * --------------------------------------------------------------------------
   */

  type RootContextType = Readonly<{
    hasHeader: boolean;
    setHasHeader: (hasHeader: boolean) => void;
    hasFooter: boolean;
    setHasFooter: (hasFooter: boolean) => void;
    hasTrigger: boolean;
    setHasTrigger: (hasTrigger: boolean) => void;
  }>;

  const RootContext = createStrictContext<RootContextType>('AxoDialog.Root');

  export type RootProps = Readonly<{
    /**
     * The controlled open state of the dialog.
     * Must be used in conjunction with `onOpenChange`.
     */
    open?: boolean;
    /**
     * Event handler called when the open state of the dialog changes.
     */
    onOpenChange?: (open: boolean) => void;
    /**
     * Should be a `Trigger` and `Content`.
     */
    children: ReactNode;
  }>;

  /**
   * Contains all the parts of a dialog.
   *
   * @example Controlled dialog (most common)
   * ```tsx
   * <AxoDialog.Root open={open} onOpenChange={onOpenChange}>
   *   <AxoDialog.Content size="sm" escape="cancel-is-noop">
   *     <AxoDialog.Header>
   *       <AxoDialog.Title>Delete attachment?</AxoDialog.Title>
   *       <AxoDialog.Close />
   *     </AxoDialog.Header>
   *     <AxoDialog.Body>
   *       <AxoDialog.Description>
   *         This attachment will be permanently deleted.
   *       </AxoDialog.Description>
   *     </AxoDialog.Body>
   *     <AxoDialog.Footer>
   *       <AxoDialog.Actions>
   *         <AxoDialog.Action variant="subtle-secondary" onClick={onCancel}>
   *           Cancel
   *         </AxoDialog.Action>
   *         <AxoDialog.Action variant="strong-destructive" onClick={onDelete}>
   *           Delete
   *         </AxoDialog.Action>
   *       </AxoDialog.Actions>
   *     </AxoDialog.Footer>
   *   </AxoDialog.Content>
   * </AxoDialog.Root>
   * ```
   *
   * @example Trigger-based dialog
   * ```tsx
   * <AxoDialog.Root>
   *   <AxoDialog.Trigger>
   *     <AxoButton.Root variant="strong-primary" size="md">
   *       Open settings
   *     </AxoButton.Root>
   *   </AxoDialog.Trigger>
   *   <AxoDialog.Content size="md" escape="cancel-is-destructive">
   *     <AxoDialog.Header>
   *       <AxoDialog.Title>Settings</AxoDialog.Title>
   *       <AxoDialog.Close />
   *     </AxoDialog.Header>
   *     <AxoDialog.Body>...</AxoDialog.Body>
   *   </AxoDialog.Content>
   * </AxoDialog.Root>
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    const [hasHeader, setHasHeader] = useState(false);
    const [hasFooter, setHasFooter] = useState(false);
    const [hasTrigger, setHasTrigger] = useState(false);

    const context = useMemo((): RootContextType => {
      return {
        hasHeader,
        setHasHeader,
        hasFooter,
        setHasFooter,
        hasTrigger,
        setHasTrigger,
      };
    }, [
      hasHeader,
      setHasHeader,
      hasFooter,
      setHasFooter,
      hasTrigger,
      setHasTrigger,
    ]);

    return (
      <RootContext value={context}>
        <Dialog.Root open={props.open} onOpenChange={props.onOpenChange} modal>
          {props.children}
        </Dialog.Root>
      </RootContext>
    );
  });

  Root.displayName = 'AxoDialog.Root';

  /**
   * <AxoDialog.Trigger>
   * --------------------------------------------------------------------------
   */

  export type TriggerProps = Readonly<{
    /**
     * Trigger doesn't have its own styles so it should always be set to true
     */
    asChild: true;
    /**
     * The element that opens the dialog when clicked.
     */
    children: ReactNode;
  }>;

  /**
   * The button that opens the dialog.
   */
  export const Trigger: FC<TriggerProps> = memo(props => {
    const { setHasTrigger } = useStrictContext(RootContext);
    const ref = useTriggerPresenceRef(setHasTrigger);

    return (
      <Dialog.Trigger ref={ref} asChild>
        {props.children}
      </Dialog.Trigger>
    );
  });

  Trigger.displayName = 'AxoDialog.Trigger';

  /**
   * <AxoDialog.Content>
   * --------------------------------------------------------------------------
   */

  /**
   * Width of the dialog.
   * - `sm` – 320px
   * - `md` – 400px
   * - `lg` – 720px
   */
  export type ContentSize = 'sm' | 'md' | 'lg';

  /**
   * How dangerous the cancel action is considered.
   * - `cancel-is-noop`: Canceling is safe — pressing Escape or clicking outside closes the dialog.
   * - `cancel-is-destructive`: Canceling would lose user state — pressing Escape or clicking outside is disabled.
   */
  export type ContentEscape = AxoBaseDialog.ContentEscape;

  const ContentSizeStyles = variants<ContentSize>('AxoDialog.ContentSize', {
    sm: tw('w-[320px] min-w-[320px]'),
    md: tw('w-[400px] min-w-[320px]'),
    lg: tw('w-[720px] min-w-[320px]'),
  });

  export type ContentProps = Readonly<{
    /**
     * Width of the dialog.
     */
    size: ContentSize;
    /**
     * What happens when the user presses `Escape` or clicks outside.
     */
    escape: ContentEscape;
    /**
     * Suppresses the Radix UI warning about a missing `aria-describedby`.
     * Prefer adding a visually-hidden `Description` instead of using this.
     */
    disableMissingAriaDescriptionWarning?: boolean;
    /**
     * Should be `Header`, `Search`, `Tabs`, `Body`, `Footer`, and/or
     * `Description` elements.
     */
    children: ReactNode;
  }>;

  /**
   * Contains content to be rendered in the open dialog.
   */
  export const Content: FC<ContentProps> = memo(props => {
    const handleContentEscapeEvent = useContentEscapeBehavior(props.escape);
    const [boundary, setBoundary] = useState<Element | null>(null);
    const { hasTrigger } = useStrictContext(RootContext);
    const restoreFocusHandlers = useContentRestoreFocusBehavior(hasTrigger);

    const descriptionProps = useMemo((): Dialog.DialogContentProps => {
      if (props.disableMissingAriaDescriptionWarning) {
        // Generally you should just add a description with `AxoDialog.Description`
        // and use `sr-only` to hide it if you don't want it to be visible
        // https://www.radix-ui.com/primitives/docs/components/dialog#description
        return { 'aria-describedby': undefined };
      }
      return {};
    }, [props.disableMissingAriaDescriptionWarning]);

    return (
      <Dialog.Portal>
        <AxoBaseLayer>
          <AxoTooltip.CollisionBoundary boundary={boundary} padding={4}>
            <AxoBaseDialog.Host>
              <Dialog.Overlay className={AxoBaseDialog.overlayClassName} />
              <Dialog.Content
                ref={setBoundary}
                className={tw(
                  AxoBaseDialog.contentClassName,
                  ContentSizeStyles.get(props.size)
                )}
                onEscapeKeyDown={handleContentEscapeEvent}
                onInteractOutside={handleContentEscapeEvent}
                onOpenAutoFocus={restoreFocusHandlers.onOpenAutoFocus}
                onCloseAutoFocus={restoreFocusHandlers.onCloseAutoFocus}
                {...descriptionProps}
              >
                <div className={tw('relative z-10')}>{props.children}</div>
              </Dialog.Content>
            </AxoBaseDialog.Host>
          </AxoTooltip.CollisionBoundary>
        </AxoBaseLayer>
      </Dialog.Portal>
    );
  });

  Content.displayName = 'AxoDialog.Content';

  /**
   * <AxoDialog.Header>
   * --------------------------------------------------------------------------
   */

  type HeaderContextType = Readonly<{
    floating: boolean;
  }>;

  const HeaderContext =
    createStrictContext<HeaderContextType>('AxoDialog.Header');

  export type HeaderProps = Readonly<{
    floating?: boolean;
    /**
     * Should be `Back`, `Title`, and/or `Close` elements.
     */
    children: ReactNode;
  }>;

  /**
   * A three-column grid header: back button on the left, title in the center,
   * close button on the right. Omitting `Back` or `Close` leaves their column
   * empty so the title stays centered.
   */
  export const Header: FC<HeaderProps> = memo(props => {
    const { floating = false, children } = props;
    const { setHasHeader } = useStrictContext(RootContext);

    const ref: RefCallback<HTMLElement> = useCallback(
      node => {
        if (!floating) {
          setHasHeader(node != null);
        }
        return () => {
          setHasHeader(false);
        };
      },
      [floating, setHasHeader]
    );

    const context = useMemo((): HeaderContextType => {
      return { floating };
    }, [floating]);

    return (
      <HeaderContext value={context}>
        <div
          ref={ref}
          className={tw(
            'grid items-center px-4 pt-4 pb-2',
            'grid-cols-[[back-slot]_1fr_[title-slot]_auto_[close-slot]_1fr]',
            floating && tw('pointer-events-none absolute inset-x-0 top-0 z-10')
          )}
        >
          {children}
        </div>
      </HeaderContext>
    );
  });

  Header.displayName = 'AxoDialog.Header';

  /**
   * <AxoDialog.Title>
   * --------------------------------------------------------------------------
   */

  export type TitleProps = Readonly<{
    /**
     * The title text.
     */
    children: ReactNode;
  }>;

  /**
   * An accessible title to be announced when the dialog is opened.
   */
  export const Title: FC<TitleProps> = memo(props => {
    const header = useStrictContextNullable(HeaderContext);
    return (
      <Dialog.Title
        className={tw(
          'type-body-medium font-semibold text-primary',
          header != null &&
            tw('col-[title-slot] truncate px-3.5 py-0.5 text-center'),
          header == null && tw('mb-2.5'),
          header?.floating && tw('sr-only')
        )}
      >
        {props.children}
      </Dialog.Title>
    );
  });

  Title.displayName = 'AxoDialog.Title';

  /**
   * <AxoDialog.Back>
   * --------------------------------------------------------------------------
   */

  export type BackProps = Readonly<{
    /**
     * Called when the back button is clicked.
     */
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  }>;

  /**
   * A back-navigation button rendered in the leading column of `Header`.
   */
  export const Back: FC<BackProps> = memo(props => {
    const intl = useAxoIntl();
    const { floating } = useStrictContext(HeaderContext);
    return (
      <div className={tw('pointer-events-auto col-[back-slot] text-start')}>
        <AxoIconButton.Root
          size="sm"
          variant={floating ? 'material-subtle' : 'implied-secondary'}
          symbol="chevron-[start]"
          label={intl.get('AxoDialog.Back')}
          tooltip={false}
          onClick={props.onClick}
        />
      </div>
    );
  });

  Back.displayName = 'AxoDialog.Back';

  /**
   * <AxoDialog.Close>
   * --------------------------------------------------------------------------
   */

  /**
   * The button that closes the dialog.
   */
  export const Close: FC = memo(() => {
    const intl = useAxoIntl();
    const { floating } = useStrictContext(HeaderContext);
    return (
      <div
        className={tw(
          'pointer-events-auto col-[close-slot] text-end leading-none'
        )}
      >
        <Dialog.Close asChild>
          <AxoIconButton.Root
            size="sm"
            variant={floating ? 'material-subtle' : 'implied-secondary'}
            symbol="x"
            label={intl.get('AxoDialog.Close')}
            tooltip={false}
          />
        </Dialog.Close>
      </div>
    );
  });

  Close.displayName = 'AxoDialog.Close';

  /**
   * <AxoDialog.Search>
   * --------------------------------------------------------------------------
   */

  export type SearchProps = Readonly<{
    /**
     * A search input element.
     */
    children: ReactNode;
  }>;

  /**
   * A padded slot for a search input, placed between `Header` and `Body`.
   */
  export const Search: FC<SearchProps> = memo(props => {
    return (
      <div className={tw('flex items-center gap-2 px-4 pb-2')}>
        {props.children}
      </div>
    );
  });

  Search.displayName = 'AxoDialog.Search';

  /**
   * <AxoDialog.Tabs>
   * --------------------------------------------------------------------------
   */

  type TabsContextType = Readonly<{
    value: string;
  }>;

  const TabsContext = createStrictContext<TabsContextType>('AxoDialog.Tabs');

  export type TabsProps = Readonly<{
    /**
     * The controlled value of the selected tab.
     * Must be used in conjunction with `onValueChange`.
     */
    value: string;
    /**
     * Event handler called when the selected tab changes.
     */
    onValueChange: (value: string) => void;
    /**
     * Should be a `TabList` followed by `TabContent` elements.
     */
    children: ReactNode;
  }>;

  /**
   * Splits the dialog into tabs, with a `TabList` placed between `Header`
   * and the content, and each tab's `Body` wrapped in its own `TabContent`.
   *
   * @example
   * ```tsx
   * <AxoDialog.Content size="md" escape="cancel-is-noop">
   *   <AxoDialog.Header>
   *     <AxoDialog.Title>Settings</AxoDialog.Title>
   *     <AxoDialog.Close />
   *   </AxoDialog.Header>
   *   <AxoDialog.Tabs value={tab} onValueChange={setTab}>
   *     <AxoDialog.TabList>
   *       <AxoDialog.Tab value="general">General</AxoDialog.Tab>
   *       <AxoDialog.Tab value="advanced">Advanced</AxoDialog.Tab>
   *     </AxoDialog.TabList>
   *     <AxoDialog.TabContent value="general">
   *       <AxoDialog.Body>...</AxoDialog.Body>
   *     </AxoDialog.TabContent>
   *     <AxoDialog.TabContent value="advanced">
   *       <AxoDialog.Body>...</AxoDialog.Body>
   *     </AxoDialog.TabContent>
   *   </AxoDialog.Tabs>
   * </AxoDialog.Content>
   * ```
   */

  export const Tabs: FC<TabsProps> = memo(props => {
    const { value, onValueChange } = props;
    const ref = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number>(0);
    const reducedMotion = useReducedMotion();

    const context = useMemo((): TabsContextType => {
      return { value };
    }, [value]);

    useLayoutEffect(() => {
      const target = assert(ref.current, 'Missing ref');
      const observer = new ResizeObserver(entries => {
        const entry = assert(entries[0], 'Missing entry');
        const size = assert(entry.borderBoxSize[0], 'Missing size');
        setHeight(size.blockSize);
      });
      observer.observe(target);
      return () => {
        observer.disconnect();
      };
    }, [value]);

    return (
      <TabsContext value={context}>
        <RadixTabs.Root value={value} onValueChange={onValueChange}>
          <motion.div
            initial={false}
            animate={{ height: height !== 0 ? height : 'auto' }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : ExperimentalAxoBaseSegmentedControl.IndicatorTransition
            }
            className={tw(
              'overflow-clip',
              // Don't clip the focus rings of the tabs
              '[overflow-clip-margin:4px]'
            )}
          >
            <div
              ref={ref}
              className={tw(
                // The exiting tab content is absolutely positioned against this container.
                'relative',
                // During the transition, the tab content uses `mix-blend-mode: plus-lighter`
                // so we need `isolation: isolate` so they only blend with each other.
                'isolate'
              )}
            >
              {props.children}
            </div>
          </motion.div>
        </RadixTabs.Root>
      </TabsContext>
    );
  });

  Tabs.displayName = 'AxoDialog.Tabs';

  /**
   * <AxoDialog.TabList>
   * --------------------------------------------------------------------------
   */

  export type TabListProps = Readonly<{
    /**
     * Should be `Tab` elements.
     */
    children: ReactNode;
  }>;

  /**
   * A padded slot for a segmented control of tabs, placed between `Header`
   * and the `TabContent` elements.
   */
  export const TabList: FC<TabListProps> = memo(props => {
    const { value } = useStrictContext(TabsContext);

    return (
      <div className={tw('px-4 pb-2')}>
        <RadixTabs.List asChild>
          <ExperimentalAxoBaseSegmentedControl.Root
            value={value}
            variant="track"
            width="full"
            itemWidth="equal"
          >
            {props.children}
          </ExperimentalAxoBaseSegmentedControl.Root>
        </RadixTabs.List>
      </div>
    );
  });

  TabList.displayName = 'AxoDialog.TabList';

  /**
   * <AxoDialog.Tab>
   * --------------------------------------------------------------------------
   */

  export type TabProps = Readonly<{
    /**
     * A unique value for the tab, matching a `TabContent` value.
     */
    value: string;
    /**
     * The tab label.
     */
    children: ReactNode;
  }>;

  /**
   * A tab inside `TabList`.
   */
  export const Tab: FC<TabProps> = memo(props => {
    return (
      <RadixTabs.Trigger asChild value={props.value}>
        <ExperimentalAxoBaseSegmentedControl.Item value={props.value}>
          <ExperimentalAxoBaseSegmentedControl.ItemText>
            {props.children}
          </ExperimentalAxoBaseSegmentedControl.ItemText>
        </ExperimentalAxoBaseSegmentedControl.Item>
      </RadixTabs.Trigger>
    );
  });

  Tab.displayName = 'AxoDialog.Tab';

  /**
   * <AxoDialog.TabContent>
   * --------------------------------------------------------------------------
   */

  export type TabContentProps = Readonly<{
    /**
     * The value of the `Tab` this content belongs to.
     */
    value: string;
    /**
     * Should be a `Body` element.
     */
    children: ReactNode;
  }>;

  /**
   * Must be a tween (not a spring that can overshoot) so the opacity of the
   * entering and exiting tab contents always adds up to 1 while cross fading
   */
  const TabContentTransition: Transition = {
    duration: 0.2,
    ease: 'easeInOut',
  };

  type TabContentPanelProps = Readonly<{
    /** Used by `AnimatePresence` to pop the panel out of the layout */
    ref?: Ref<HTMLDivElement>;
    value: string;
    children: ReactNode;
  }>;

  /**
   * The content for a single tab, only rendered while its tab is selected.
   */
  const TabContentPanel: FC<TabContentPanelProps> = memo(props => {
    const isPresent = useIsPresent();
    return (
      <RadixTabs.Content
        ref={props.ref}
        value={props.value}
        // Needed for animation
        forceMount
        asChild
      >
        <motion.div
          // Can't be focused or read while fading out
          inert={!isPresent}
          className={tw(
            'focus-visible:axo-focus-ring',
            // Adds the entering and exiting tab contents together instead of
            // layering them, so content that's the same in both tabs stays
            // fully opaque during the cross fade instead of dimming
            'mix-blend-plus-lighter'
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={TabContentTransition}
        >
          {props.children}
        </motion.div>
      </RadixTabs.Content>
    );
  });

  TabContentPanel.displayName = 'AxoDialog.TabContentPanel';

  export const TabContent: FC<TabContentProps> = memo(props => {
    const { value } = useStrictContext(TabsContext);
    return (
      // `popLayout` takes the exiting panel out of the layout so both panels
      // overlap while they cross fade (and the height only follows the new one)
      <AnimatePresence initial={false} mode="popLayout">
        {value === props.value && (
          <TabContentPanel key={props.value} value={props.value}>
            {props.children}
          </TabContentPanel>
        )}
      </AnimatePresence>
    );
  });

  TabContent.displayName = 'AxoDialog.TabContent';

  /**
   * <AxoDialog.Body>
   * --------------------------------------------------------------------------
   */

  /**
   * Horizontal padding applied to the body content.
   * - lg: 24px (default) - Generally used for more textual body content.
   * - md: 16px - Generally used for "card-style" content like AxoLists.
   * - sm: 12px - Generally used for AxoItems that are not wrapped with "card-style" lists.
   * - deprecated-only-scrollbar-gutter: No padding, fallback to browser's native scrollbar
   *   gutter handling which is unreliable depending on your OS scrollbar preference.
   */
  export type BodyPadding =
    | 'lg'
    | 'md'
    | 'sm'
    | 'deprecated-only-scrollbar-gutter';

  export type BodyProps = Readonly<{
    /**
     * Width of the native scrollbar track.
     */
    scrollbarWidth?: 'thin' | 'none';
    /**
     * Horizontal padding applied to the body content.
     * Defaults to `lg`.
     */
    padding?: BodyPadding;
    /**
     * Maximum height before the body becomes scrollable.
     * Defaults to `440`.
     */
    maxHeight?: number;
    /**
     * Force the dialog to always be at its maxHeight
     */
    forceMaxHeight?: boolean;
    /**
     * Whether the text inside the body is selectable.
     */
    selectableText?: boolean;
    /**
     * The scrollable body content.
     */
    children: ReactNode;
  }>;

  /**
   * Scrollable content area between `Header` and `Footer`.
   * Automatically shows scroll hints and a thin scrollbar.
   */
  export const Body: FC<BodyProps> = memo(props => {
    const { hasHeader, hasFooter } = useStrictContext(RootContext);
    const scrollbarWidthDefault = hasHeader && hasFooter ? 'thin' : 'none';
    const {
      scrollbarWidth = scrollbarWidthDefault,
      padding = 'lg',
      maxHeight = 440,
      forceMaxHeight,
      selectableText,
    } = props;

    const style = useMemo((): CSSProperties | undefined => {
      const styles: CSSProperties = {};

      if (forceMaxHeight) {
        styles.minHeight = maxHeight;
      }

      let paddingInline: string | null;

      if (padding === 'lg') {
        paddingInline = '24px';
      } else if (padding === 'md') {
        paddingInline = '16px';
      } else if (padding === 'sm') {
        paddingInline = '12px';
      } else if (padding === 'deprecated-only-scrollbar-gutter') {
        paddingInline = null;
      } else {
        unreachable(padding);
      }

      if (paddingInline != null) {
        if (scrollbarWidth === 'thin') {
          paddingInline = `calc(${paddingInline} - var(--axo-scrollbar-gutter-thin-vertical))`;
        } else if (scrollbarWidth === 'none') {
          // ignore
        } else {
          unreachable(scrollbarWidth);
        }

        styles.paddingInline = paddingInline;
      }

      let paddingBlockDefault: string;
      if (padding === 'lg') {
        paddingBlockDefault = '24px';
      } else if (padding === 'md') {
        paddingBlockDefault = '16px';
      } else if (padding === 'sm') {
        paddingBlockDefault = '12px';
      } else if (padding === 'deprecated-only-scrollbar-gutter') {
        paddingBlockDefault = '2px';
      } else {
        unreachable(padding);
      }

      styles.paddingBlockStart = hasHeader ? '2px' : paddingBlockDefault;
      styles.paddingBlockEnd = hasFooter ? '2px' : paddingBlockDefault;

      return styles;
    }, [
      forceMaxHeight,
      maxHeight,
      padding,
      scrollbarWidth,
      hasHeader,
      hasFooter,
    ]);

    return (
      <AxoScrollArea.Root
        maxHeight={maxHeight}
        scrollbarWidth={scrollbarWidth}
        scrollbarVisibility="as-needed"
        overscrollBehavior="auto"
      >
        {hasHeader && <AxoScrollArea.Hint edge="top" />}
        {hasFooter && <AxoScrollArea.Hint edge="bottom" />}
        <AxoScrollArea.Viewport>
          <AxoScrollArea.Content>
            <div className={tw(selectableText && 'select-text')} style={style}>
              {props.children}
            </div>
          </AxoScrollArea.Content>
        </AxoScrollArea.Viewport>
      </AxoScrollArea.Root>
    );
  });

  Body.displayName = 'AxoDialog.Body';

  /**
   * <AxoDialog.Description>
   * --------------------------------------------------------------------------
   */

  export type DescriptionProps = Readonly<{
    /**
     * The description text.
     */
    children: ReactNode;
  }>;

  /**
   * An optional accessible description to be announced when the dialog is opened.
   */
  export const Description: FC<DescriptionProps> = memo(props => {
    return (
      <Dialog.Description asChild>
        <div>{props.children}</div>
      </Dialog.Description>
    );
  });

  Description.displayName = 'AxoDialog.Description';

  /**
   * <AxoDialog.Body>
   * --------------------------------------------------------------------------
   */

  export type FooterProps = Readonly<{
    /**
     * Should be `FooterContent` and/or `Actions` elements.
     */
    children?: ReactNode;
  }>;

  /**
   * A row of action buttons at the bottom of the dialog.
   */
  export const Footer: FC<FooterProps> = memo(props => {
    const { setHasFooter } = useStrictContext(RootContext);

    const ref: RefCallback<HTMLElement> = useCallback(
      node => {
        setHasFooter(node != null);
        return () => {
          setHasFooter(false);
        };
      },
      [setHasFooter]
    );

    return (
      <div
        ref={ref}
        className={tw(
          'flex flex-wrap items-center',
          'gap-x-2 gap-y-3',
          'px-4 pt-2.5 pb-4'
        )}
      >
        {props.children}
      </div>
    );
  });

  Footer.displayName = 'AxoDialog.Footer';

  /**
   * <AxoDialog.FooterContent>
   * --------------------------------------------------------------------------
   */

  export type FooterContentProps = Readonly<{
    /**
     * Supplementary text shown alongside the action buttons.
     */
    children: ReactNode;
  }>;

  /**
   * Optional text content placed in `Footer` alongside `Actions`.
   *
   * Flows into its own row when the available width is too narrow to share a
   * line.
   */
  export const FooterContent: FC<FooterContentProps> = memo(props => {
    return (
      <div
        className={tw(
          'px-2',
          // Allow the flex layout to place it in the same row as the actions
          // if it can be wrapped to fit within the available space:
          'basis-[min-content]',
          // But if the text needs to wrap and the available space could only
          // fit 1-2 words per line, push it up into its own row:
          'min-w-[calc-size(fit-content,min(20ch,size))]',
          // Allow it to fill its own row
          'grow',
          'type-body-medium text-primary'
        )}
      >
        {props.children}
      </div>
    );
  });

  FooterContent.displayName = 'AxoDialog.FooterContent';

  /**
   * <AxoDialog.Actions>
   * --------------------------------------------------------------------------
   */

  const footerWrapDetectorStyles = tw(
    // When actions are not being wrapped:
    // Try to keep all actions equal size, but don't truncate them.
    'container-not-scrollable:*:basis-0',
    'container-not-scrollable:*:min-w-fit',
    // When actions are being wrapped:
    // Make all of them full width
    'container-scrollable:*:w-full'
  );

  // oxlint-disable-next-line better-tailwindcss/no-restricted-classes
  const footerWrapForcedBreakStyles = tw('*:w-full');

  export type ActionsWidth = 'fill' | 'fit';

  export type ActionsProps = Readonly<{
    /**
     * Make actions 'fill' the width of the footer or 'fit' aligned to the end.
     */
    width?: ActionsWidth;
    /**
     * Force actions to always break onto separate lines, even if they fit onto
     * one line.
     */
    forceAlwaysBreakToSeparateLines?: boolean | null;
    /**
     * Should be `Action` and/or `IconAction` elements.
     */
    children: ReactNode;
  }>;

  /**
   * A right-aligned group of action buttons inside `Footer`.
   */
  export const Actions: FC<ActionsProps> = memo(props => {
    const { width = 'fit', children } = props;

    let contents = (
      <div
        className={tw(
          'flex flex-wrap-reverse',
          'max-w-full',
          'items-center gap-x-2 gap-y-3',
          width === 'fill' && 'w-full',
          props.forceAlwaysBreakToSeparateLines
            ? footerWrapForcedBreakStyles
            : footerWrapDetectorStyles
        )}
      >
        {children}
      </div>
    );

    if (!props.forceAlwaysBreakToSeparateLines) {
      contents = (
        <FlexWrapDetector.Root width={width}>{contents}</FlexWrapDetector.Root>
      );
    }

    if (width === 'fit') {
      contents = <div className={tw('ms-auto')}>{contents}</div>;
    }

    return contents;
  });

  Actions.displayName = 'AxoDialog.Actions';

  /**
   * <AxoDialog.Actions>
   * --------------------------------------------------------------------------
   */

  /**
   * Visual style of an action button.
   * - `strong-primary`: High-emphasis confirm action.
   * - `subtle-secondary`: Low-emphasis cancel or alternative action.
   * - `strong-destructive` or `subtle-destructive`: Irreversible or dangerous action.
   *
   * Note: These have been removed and should not be used
   * 1. 'strong-secondary'
   * 2. 'subtle-primary'
   */
  export type ActionVariant =
    | 'strong-primary'
    | 'subtle-secondary'
    | 'strong-destructive'
    | 'subtle-destructive';

  export type Arrow = 'next' | 'external-link';

  export type ActionProps = Readonly<{
    /**
     * Visual style of the button.
     */
    variant: ActionVariant;
    /**
     * Optional leading icon.
     */
    symbol?: AxoSymbol.Name;
    /**
     * When `true`, shows a forward arrow on the trailing side.
     */
    arrow?: Arrow | null;
    /**
     * When `true`, shows a loading spinner and prevents interaction.
     */
    pending?: boolean | null;
    /**
     * When `true`, prevents interaction.
     */
    disabled?: boolean | null;
    /**
     * Event handler called when the button is clicked.
     */
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
    /**
     * When `true`, takes initial focus when rendered.
     */
    autoFocus?: boolean | null;
    /**
     * The button label.
     */
    children: ReactNode;
  }>;

  /**
   * A button for use inside `Actions`.
   */
  export const Action: FC<ActionProps> = memo(props => {
    return (
      <AxoButton.Root
        variant={props.variant}
        symbol={props.symbol}
        arrow={props.arrow}
        pending={props.pending}
        disabled={props.disabled}
        size="md"
        width="grow"
        onClick={props.onClick}
        autoFocus={props.autoFocus}
      >
        {props.children}
      </AxoButton.Root>
    );
  });

  Action.displayName = 'AxoDialog.Action';

  /**
   * <AxoDialog.IconAction>
   * --------------------------------------------------------------------------
   */

  /**
   * Visual style of an icon action button.
   * - `strong-primary`: High-emphasis confirm action.
   * - `subtle-secondary`: Low-emphasis cancel or alternative action.
   * - `strong-destructive`: Irreversible or dangerous action.
   */
  export type IconActionVariant =
    | 'strong-primary'
    | 'strong-destructive'
    | 'subtle-secondary';

  export type IconActionProps = Readonly<{
    /**
     * Accessible label for screen readers.
     * Should describe the action of the button, not the icon.
     */
    label: string;
    /**
     * Visual style of the button.
     */
    variant: IconActionVariant;
    /**
     * The icon to display.
     */
    symbol: AxoSymbol.Name;
    /**
     * Event handler called when the button is clicked.
     */
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  }>;

  /**
   * An icon-only button for use inside `Actions`.
   */
  export const IconAction: FC<IconActionProps> = memo(props => {
    return (
      <AxoIconButton.Root
        label={props.label}
        variant={props.variant}
        size="md"
        symbol={props.symbol}
        onClick={props.onClick}
      />
    );
  });

  IconAction.displayName = 'AxoDialog.IconAction';

  /**
   * <AxoDialog.StoryTrigger>
   * --------------------------------------------------------------------------
   */

  export type StoryTriggerProps = Readonly<{
    ref?: Ref<HTMLButtonElement>;
  }>;

  export const StoryTrigger: FC<StoryTriggerProps> = memo(props => {
    const { ref, ...rest } = props;
    const innerRef = useRef<HTMLButtonElement>(null);
    const hasClickedRef = useRef(false);

    useEffect(() => {
      if (!hasClickedRef.current) {
        assert(innerRef.current).click();
        hasClickedRef.current = true;
      }
    }, []);

    return (
      <AxoButton.Root
        ref={mergeRefs(innerRef, ref)}
        size="md"
        variant="strong-primary"
        {...forwardExtraPropsForRadix(rest)}
      >
        Open Dialog
      </AxoButton.Root>
    );
  });

  StoryTrigger.displayName = 'AxoDialog.StoryTrigger';
}
