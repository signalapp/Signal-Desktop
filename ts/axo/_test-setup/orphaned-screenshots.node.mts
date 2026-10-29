// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { globSync, rmSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import type {
  Reporter,
  TestModule,
  TestProject,
  TestRunEndReason,
  Vitest,
} from 'vitest/node';

// Vitest's default, which it doesn't export
const DEFAULT_SCREENSHOT_DIRECTORY = '__screenshots__';
// The only format that `toMatchScreenshot()` supports
const SCREENSHOT_EXTENSION = '.png';

const usedScreenshots = new Set<string>();

export type ResolveScreenshotPathData = Readonly<{
  arg: string;
  ext: string;
  browserName: string;
  platform: string;
  root: string;
  testFileDirectory: string;
  testFileName: string;
  screenshotDirectory: string;
}>;

/**
 * Same as Vitest's default path for reference screenshots, but remembers
 * which screenshots were used so that unused ones can be found.
 */
export function resolveScreenshotPath(data: ResolveScreenshotPathData): string {
  const fileName = `${data.arg}-${data.browserName}-${data.platform}${data.ext}`;
  const path = resolve(
    data.root,
    data.testFileDirectory,
    data.screenshotDirectory,
    data.testFileName,
    fileName
  );
  usedScreenshots.add(path);
  return path;
}

/**
 * Vitest replaces a browser project with one project per browser instance,
 * which are named "<project> (<browser>)" by default.
 */
function isProjectOrInstance(project: TestProject, name: string): boolean {
  return project.name === name || project.name.startsWith(`${name} (`);
}

/**
 * Every test file in the project ran, without filtering tests by name or
 * `.only`
 */
function isFullRun(
  project: TestProject,
  testModules: ReadonlyArray<TestModule>,
  testFiles: ReadonlyArray<string>
): boolean {
  if (project.vitest.config.testNamePattern != null) {
    return false;
  }

  const ranFiles = new Set<string>();
  for (const testModule of testModules) {
    if (testModule.project !== project) {
      continue;
    }
    for (const testCase of testModule.children.allTests()) {
      if (testCase.options.mode !== 'run') {
        return false;
      }
    }
    ranFiles.add(testModule.moduleId);
  }

  for (const testFile of testFiles) {
    if (!ranFiles.has(testFile)) {
      return false;
    }
  }
  return true;
}

/**
 * Reference screenshots that the project's tests would save, but that none
 * of them used.
 */
function findOrphanedScreenshots(
  project: TestProject,
  testFiles: ReadonlyArray<string>
): ReadonlyArray<string> {
  const { browser } = project.config;
  const screenshotDirectory =
    browser.expect?.toMatchScreenshot?.screenshotDirectory ??
    DEFAULT_SCREENSHOT_DIRECTORY;
  // Screenshots for other browsers and platforms are never used by this one
  const suffix = `-${browser.name}-${process.platform}${SCREENSHOT_EXTENSION}`;

  // Look in the screenshot directories next to every test file, which also
  // finds screenshots of test files that were removed
  const directories = new Set<string>();
  for (const testFile of testFiles) {
    directories.add(resolve(dirname(testFile), screenshotDirectory));
  }

  const orphans: Array<string> = [];
  for (const directory of directories) {
    for (const file of globSync(`**/*${suffix}`, { cwd: directory })) {
      const path = resolve(directory, file);
      if (!usedScreenshots.has(path)) {
        orphans.push(path);
      }
    }
  }
  return orphans;
}

export type OrphanedScreenshotsReporterOptions = Readonly<{
  /** The project that runs the visual tests */
  projectName: string;
}>;

/**
 * Vitest never deletes reference screenshots, so they would stay around after
 * the story or test that created them is renamed or removed.
 *
 * After a full run of the visual tests, this fails if there are screenshots
 * that no test used. Runs with `--update` delete them instead.
 *
 * The project needs to use `resolveScreenshotPath` from this file.
 */
export class OrphanedScreenshotsReporter implements Reporter {
  readonly #projectName: string;
  #vitest: Vitest | null = null;

  constructor(options: OrphanedScreenshotsReporterOptions) {
    this.#projectName = options.projectName;
  }

  onInit(vitest: Vitest): void {
    this.#vitest = vitest;
  }

  async onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    _unhandledErrors: ReadonlyArray<unknown>,
    reason: TestRunEndReason
  ): Promise<void> {
    const vitest = this.#vitest;
    // Tests that failed before taking their screenshot would look unused
    if (vitest == null || reason !== 'passed') {
      return;
    }

    let testFileCount = 0;
    const orphans: Array<string> = [];
    for (const project of vitest.projects) {
      if (!isProjectOrInstance(project, this.#projectName)) {
        continue;
      }
      // oxlint-disable-next-line no-await-in-loop
      const { testFiles } = await project.globTestFiles();
      if (!isFullRun(project, testModules, testFiles)) {
        return;
      }
      testFileCount += testFiles.length;
      orphans.push(...findOrphanedScreenshots(project, testFiles));
    }

    // Otherwise every screenshot would look unused, and `--update` would
    // delete all of them
    if (testFileCount > 0 && usedScreenshots.size === 0) {
      throw new Error(
        `No screenshots in the "${this.#projectName}" project used ` +
          'resolveScreenshotPath() from orphaned-screenshots.node.mts, ' +
          'set it as browser.expect.toMatchScreenshot.resolveScreenshotPath ' +
          'in vitest.config.mts'
      );
    }

    if (orphans.length === 0) {
      return;
    }

    const { root } = vitest.config;
    const list = orphans
      .sort()
      .map(path => `  ${relative(root, path)}`)
      .join('\n');

    if (vitest.config.snapshotOptions.updateSnapshot === 'all') {
      for (const path of orphans) {
        rmSync(path);
      }
      vitest.logger.log(`\nDeleted unused reference screenshots:\n${list}\n`);
      return;
    }

    vitest.logger.error(
      `\nThese reference screenshots aren't used by any test anymore, ` +
        `delete them or run the visual tests with --update:\n${list}\n`
    );
    process.exitCode = 1;
  }
}
