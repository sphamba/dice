import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { resolveConfig } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const configFile = fileURLToPath(new URL('../vite.config.js', import.meta.url));

const resolve = (command, isPreview = false) =>
  resolveConfig({ root, configFile, logLevel: 'silent' }, command, 'development', 'development', isPreview);

test('the dev server serves https', async () => {
  const config = await resolve('serve');
  expect(config.server.https?.cert).toBeTruthy();
  expect(config.server.https?.key).toBeTruthy();
});

test('the preview server serves https', async () => {
  const config = await resolve('serve', true);
  expect(config.preview.https?.cert).toBeTruthy();
});

test('the build is not affected', async () => {
  const config = await resolve('build');
  expect(config.server.https).toBeUndefined();
  expect(config.preview.https).toBeUndefined();
});
