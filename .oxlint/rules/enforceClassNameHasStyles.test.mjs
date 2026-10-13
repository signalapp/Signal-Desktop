// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check
import { enforceClassNameHasStyles } from './enforceClassNameHasStyles.mjs';
import { RuleTester } from '@typescript-eslint/rule-tester';

const stylesheet =
  '.oxlint/rules/fixtures/enforceClassNameHasStyles/manifest.css';

/** @type {[import("./enforceClassNameHasStyles.mjs").Options]} */
const options = [{ stylesheet }];

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

/**
 * @param {string} className
 * @param {{ line?: number, column?: number, endColumn?: number }=} loc
 */
function noStyles(className, loc) {
  return /** @type {const} */ ({
    messageId: 'noStyles',
    data: { className, stylesheet },
    ...loc,
  });
}

/**
 * @template {{ code: string }} T
 * @param {ReadonlyArray<T>} cases
 */
function withFixture(cases) {
  return cases.map(testCase => {
    return { options, ...testCase };
  });
}

ruleTester.run('enforce-class-name-has-styles', enforceClassNameHasStyles, {
  valid: withFixture([
    // JSX attributes
    { code: `<div className="Foo"/>` },
    { code: `<div className={"Foo Foo--a"}/>` },
    { code: `<div className="  Foo   Foo--a  "/>` },
    { code: `<div className/>` },
    { code: `<div className={undefined}/>` },

    // Dynamic values are reported by enforce-static-class-names instead
    { code: `<div className={props.className}/>` },
    { code: `<div className={variant}/>` },
    { code: `<div className={getFoo()}/>` },
    { code: `<div className={styles[variant]}/>` },
    {
      code: `
        import { FOO } from './foo';
        <div className={FOO}/>
      `,
    },

    // classNames()
    {
      code: `
        classNames(
          'Foo',
          cond && 'Foo--a',
          cond ? 'Foo--b' : null,
          ['Themed', ...['Child']],
          { InMedia: cond, 'InNot': cond, ['InHas']: cond }
        )
      `,
    },
    { code: `classNames(className, props.iconClassName)` },
    { code: `classNames()` },

    // Selectors nested in combinators, pseudos, and at-rules
    { code: `<div className="Child"/>` },
    { code: `<div className="Themed"/>` },
    { code: `<div className="InNot"/>` },
    { code: `<div className="InHas"/>` },
    { code: `<div className="InMedia"/>` },

    // tw() and axo css() are styled outside of manifest.css
    { code: `<div className={tw('p-4 flex')}/>` },
    { code: `<div className={classNames('Foo', tw('p-4'))}/>` },
    { code: `<div className={css('axo-item-root', tw('group'))}/>` },
    { code: `classNames('Foo', 'axo-anything')` },
    { code: `<div className="axo-button-strong-primary"/>` },
    {
      code: `
        const TextSizes = variants<Size>('AxoBadge.Size', {
          dot: tw('sr-only'),
          sm: tw('text-[8px] leading-3.5'),
        });
        <span className={TextSizes.get(size)}/>
      `,
    },
    {
      code: `
        const Slots = variants<Slot>('AxoBaseField.Slot', {
          leading: css('axo-field-leading'),
          trailing: css('axo-field-trailing'),
        });
        <span className={css(Slots.get('leading'), 'axo-field-icon')}/>
      `,
    },

    // Lookup tables
    {
      code: `
        const SIZE_CLASS_NAMES = new Map<ButtonSize, string>([
          [ButtonSize.Large, 'module-Button--large'],
        ]);
        function Button({ size }) {
          const sizeClassName = SIZE_CLASS_NAMES.get(size);
          return <button className={classNames('module-Button', sizeClassName)}/>;
        }
      `,
    },
    {
      code: `
        const WidthBreakpointClassNames: Record<WidthBreakpoint, string> = {
          [WidthBreakpoint.Wide]: 'Foo--a',
          [WidthBreakpoint.Medium]: 'Foo--b',
        };
        <div className={WidthBreakpointClassNames[containerWidthBreakpoint]}/>
      `,
    },
    {
      code: `
        const STYLES = { foo: 'Foo', other: 'Unstyled' } as const;
        <div className={STYLES.foo}/>
      `,
    },
    {
      code: `
        const LIST = ['Foo--a', 'Foo--b'];
        <div className={LIST[index]}/>
      `,
    },

    // Constants
    {
      code: `
        const moduleName = 'Foo';
        <span className={classNames(moduleName, direction ? 'Foo--a' : null)}/>
      `,
    },
    {
      code: `
        const commonClassNames = classNames('Foo', cond && 'Foo--a');
        <div className={commonClassNames}/>
      `,
    },

    // Unstyled modifiers can be avoided with null
    {
      code: `
        let tooltipThemeClassName: string | null;
        if (theme === Theme.Light) {
          tooltipThemeClassName = null;
        } else {
          tooltipThemeClassName = 'dark-theme';
        }
        <div className={classNames('Foo', tooltipThemeClassName)}/>
      `,
    },

    // Functions
    {
      code: `
        export function themeClassName(theme: Theme): string {
          switch (theme) {
            case Theme.Dark:
              return 'dark-theme';
            default:
              throw missingCaseError(theme);
          }
        }
        <div className={themeClassName(theme)}/>
      `,
    },
    {
      code: `
        const getClassName = (): string => {
          if (isMacOS()) {
            return 'os-macos';
          }
          return null;
        };
      `,
    },
    {
      code: `
        const getClassName = useCallback(() => {
          return cond ? 'Foo--a' : 'Foo--b';
        }, [cond]);
      `,
    },
    {
      code: `
        const iconClassName = useMemo(() => {
          return cond ? 'Foo--a' : 'Foo--b';
        }, [cond]);
      `,
    },
    {
      code: `
        function getVariant(variant) {
          return variant === 'a' ? 'Foo--a' : 'Foo--b';
        }
        <div className={getVariant(variant)}/>
      `,
    },
    {
      // Returns from nested functions aren't class names
      code: `
        function getClassName() {
          const items = list.map(item => {
            return 'not-a-class';
          });
          return 'Foo';
        }
      `,
    },

    // Props and objects
    { code: `<CustomComponent iconClassName="Foo--a"/>` },
    { code: `const items = [{ iconClassName: 'Foo' }];` },
    { code: `function Foo({ className = 'Foo' }) {}` },
    { code: `const { iconClassName: icon = 'Foo' } = props;` },
    { code: `<div className={AxoBaseDialog.overlayClassName}/>` },

    // Quill blots
    {
      code: `
        export class SpoilerBlot extends Inline {
          static override blotName = 'spoiler';
          static override className = 'quill--spoiler';
        }
      `,
    },

    // DOM APIs
    { code: `document.body.classList.add('dark-theme');` },
    { code: `document.body.classList.remove('dark-theme', 'os-macos');` },
    { code: `quill.root.classList.toggle('quill--spoiler', isBlank);` },
    { code: `node.classList.contains('mention-blot');` },
    { code: `document.body.classList.add(osClassName);` },
    { code: `element.className = 'Foo';` },
    { code: `element.setAttribute('class', 'Foo');` },
    { code: `element.setAttribute('id', 'Unstyled');` },

    // Not class names
    { code: `<div id="Unstyled" data-testid="Unstyled"/>` },
    { code: `const label = 'Unstyled';` },
    { code: `<span key="external-1" className="Foo"/>` },
    { code: `window.locator('.Unstyled');` },
  ]),
  invalid: withFixture([
    // JSX attributes
    {
      code: `<div className="Unstyled"/>`,
      errors: [noStyles('Unstyled', { line: 1, column: 17, endColumn: 25 })],
    },
    {
      code: `<div className="Foo Unstyled Other"/>`,
      errors: [
        noStyles('Unstyled', { column: 21, endColumn: 29 }),
        noStyles('Other', { column: 30, endColumn: 35 }),
      ],
    },
    {
      code: `<div className={'Unstyled'}/>`,
      errors: [noStyles('Unstyled', { column: 18, endColumn: 26 })],
    },
    {
      code: `<div className={\`Unstyled\`}/>`,
      errors: [noStyles('Unstyled', { column: 18, endColumn: 26 })],
    },
    {
      // Unstyled classes only used as test selectors are still reported
      code: `<div className="ConversationView"/>`,
      errors: [noStyles('ConversationView')],
    },
    {
      code: `<div className={cond ? 'Foo' : 'Unstyled'}/>`,
      errors: [noStyles('Unstyled')],
    },
    {
      code: `<div className={props.className ?? 'Unstyled'}/>`,
      errors: [noStyles('Unstyled')],
    },

    // classNames()
    {
      code: `classNames('Foo', cond && 'module-message__error--error')`,
      errors: [noStyles('module-message__error--error')],
    },
    {
      code: `classNames({ 'Unstyled': cond, Other: cond, ['Third']: cond })`,
      errors: [noStyles('Unstyled'), noStyles('Other'), noStyles('Third')],
    },
    {
      code: `classNames(['Foo', ...['Unstyled']])`,
      errors: [noStyles('Unstyled')],
    },
    {
      // classNames() nested in css() is still checked
      code: `<div className={css(classNames('Unstyled', cond && 'Foo'), tw('p-4'))}/>`,
      errors: [noStyles('Unstyled')],
    },
    {
      // Tailwind classes not wrapped in tw()
      code: `<div className="flex"/>`,
      errors: [noStyles('flex')],
    },

    // Props and objects
    {
      code: `<CustomComponent iconClassName="NavTabs__ItemIcon--Unstyled"/>`,
      errors: [noStyles('NavTabs__ItemIcon--Unstyled')],
    },
    {
      code: `const items = [{ iconClassName: 'Unstyled' }];`,
      errors: [noStyles('Unstyled')],
    },
    {
      code: `
        const rootProps = {
          className: classNames('Foo', isClickable && 'Unstyled', className),
          tabIndex: 0,
        };
      `,
      errors: [noStyles('Unstyled', { line: 3 })],
    },
    {
      code: `function Foo({ className = 'Unstyled' }) {}`,
      errors: [noStyles('Unstyled')],
    },
    {
      code: `const { iconClassName: icon = 'Unstyled' } = props;`,
      errors: [noStyles('Unstyled')],
    },
    {
      code: `class Foo { iconClassName = 'Unstyled'; }`,
      errors: [noStyles('Unstyled')],
    },

    // Variables named *ClassName
    {
      code: `
        let tooltipThemeClassName: string | null;
        if (theme === Theme.Light) {
          tooltipThemeClassName = 'module-tooltip--light-theme';
        } else {
          tooltipThemeClassName = null;
        }
      `,
      errors: [noStyles('module-tooltip--light-theme', { line: 4 })],
    },
    {
      code: `
        let colorClassName: string;
        colorClassName = 'module-quote--color-unknown';
      `,
      errors: [noStyles('module-quote--color-unknown', { line: 3 })],
    },
    {
      code: `const iconClassName = cond ? 'Foo' : 'Unstyled';`,
      errors: [noStyles('Unstyled')],
    },
    {
      code: `element.className += ' Unstyled';`,
      errors: [noStyles('Unstyled')],
    },

    // Constants and lookup tables are resolved
    {
      code: `
        const moduleName = 'Unstyled';
        <span className={classNames(moduleName, direction ? 'Foo--a' : null)}/>
      `,
      errors: [noStyles('Unstyled', { line: 2 })],
    },
    {
      // Shared values are only reported once
      code: `
        const base = 'Unstyled';
        <>
          <div className={base}/>
          <div className={base}/>
        </>
      `,
      errors: [noStyles('Unstyled', { line: 2 })],
    },
    {
      code: `
        const SIZE_CLASS_NAMES = new Map<ButtonSize, string>([
          [ButtonSize.Large, 'module-Button--large'],
          [ButtonSize.Small, 'module-Button--small'],
        ]);
        <button className={SIZE_CLASS_NAMES.get(size)}/>
      `,
      errors: [noStyles('module-Button--small', { line: 4 })],
    },
    {
      code: `
        const CLASS_NAMES = { a: 'Foo--a', c: 'Foo--c' };
        <div className={CLASS_NAMES[variant]}/>
      `,
      errors: [noStyles('Foo--c', { line: 2 })],
    },
    {
      // Only the matching key is checked
      code: `
        const STYLES = { foo: 'Unstyled', bar: 'Other' };
        <div className={STYLES.foo}/>
      `,
      errors: [noStyles('Unstyled', { line: 2 })],
    },
    {
      code: `
        const LIST = ['Foo', 'Unstyled'];
        <div className={LIST[index]}/>
      `,
      errors: [noStyles('Unstyled', { line: 2 })],
    },
    {
      code: `
        const Variants = variants<Variant>('Foo.Variant', {
          a: 'Foo--a',
          c: 'Foo--c',
        });
        <div className={Variants.get(variant)}/>
      `,
      errors: [noStyles('Foo--c', { line: 4 })],
    },

    // Functions
    {
      // OS.getClassName()
      code: `
        const getClassName = (): string => {
          if (isMacOS()) {
            return 'os-macos';
          }
          if (isWindows()) {
            return 'os-windows';
          }
          return 'os-linux';
        };
      `,
      errors: [
        noStyles('os-windows', { line: 7 }),
        noStyles('os-linux', { line: 9 }),
      ],
    },
    {
      code: `
        <div className={getVariant(variant)}/>;
        function getVariant(variant) {
          return variant === 'a' ? 'Foo--a' : 'Foo--c';
        }
      `,
      errors: [noStyles('Foo--c', { line: 4 })],
    },
    {
      code: `
        export function themeClassName(theme: Theme): string {
          switch (theme) {
            case Theme.Light:
              return 'light-theme';
            case Theme.Dark:
              return 'dark-theme';
          }
        }
      `,
      errors: [noStyles('light-theme', { line: 5 })],
    },
    {
      code: `const getClassName = () => 'Unstyled';`,
      errors: [noStyles('Unstyled')],
    },
    {
      code: `
        const iconClassName = useMemo(() => {
          return 'Unstyled';
        }, []);
      `,
      errors: [noStyles('Unstyled', { line: 3 })],
    },
    {
      code: `
        const getClassName = useCallback(() => 'Unstyled', []);
      `,
      errors: [noStyles('Unstyled', { line: 2 })],
    },
    {
      code: `class Foo { getClassName() { return 'Unstyled'; } }`,
      errors: [noStyles('Unstyled')],
    },
    {
      code: `const obj = { getClassName() { return 'Unstyled'; } };`,
      errors: [noStyles('Unstyled')],
    },

    // Quill blots
    {
      code: `
        export class MentionBlot extends EmbedBlot {
          static override blotName = 'mention';
          static override className = 'mention-blot';
        }
      `,
      errors: [noStyles('mention-blot', { line: 4 })],
    },

    // DOM APIs
    {
      // light-theme is only styled in tailwind.css
      code: `document.body.classList.add(theme === 'light' ? 'light-theme' : 'dark-theme');`,
      errors: [noStyles('light-theme')],
    },
    {
      code: `document.body.classList.remove('dark-theme', 'Unstyled');`,
      errors: [noStyles('Unstyled')],
    },
    {
      code: `element.classList.toggle('Unstyled', true);`,
      errors: [noStyles('Unstyled')],
    },
    {
      code: `element.classList.replace('Foo', 'Unstyled');`,
      errors: [noStyles('Unstyled')],
    },
    {
      code: `element.className = 'Unstyled';`,
      errors: [noStyles('Unstyled')],
    },
    {
      code: `element.setAttribute('class', 'Unstyled');`,
      errors: [noStyles('Unstyled')],
    },

    // Escaped strings report the whole node
    {
      code: `<div className={'Foo\\u0020Unstyled'}/>`,
      errors: [noStyles('Unstyled', { column: 17, endColumn: 36 })],
    },

    // Missing stylesheet is reported once per file
    {
      code: `<div className={classNames('Foo', 'Bar')}/>`,
      options: [{ stylesheet: 'does/not/exist.css' }],
      errors: [
        {
          messageId: 'missingStylesheet',
          data: { stylesheet: 'does/not/exist.css' },
        },
      ],
    },
  ]),
});
