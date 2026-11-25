import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageTags, parseVersion } from './image-tags.mjs';

const image = 'maretu01/ai-trust-dashboard';
const commit = 'a'.repeat(40);
const tags = (version, knownVersions = []) => imageTags({ image, version, commit, knownVersions });
const promotes = (version, knownVersions = []) => tags(version, knownVersions).includes(`${image}:latest`);

test('first stable release publishes version, full SHA and latest', () => {
  assert.deepEqual(tags('v1.0.0'), [
    `${image}:v1.0.0`, `${image}:sha-${commit}`, `${image}:latest`,
  ]);
});

test('prereleases publish their exact version without promoting latest', () => {
  for (const version of ['v1.1.0-beta.1', 'v2.0.0-rc.0', 'v1.0.0-0']) {
    assert.deepEqual(tags(version), [`${image}:${version}`, `${image}:sha-${commit}`]);
  }
});

test('backfilling an old stable release preserves latest', () => {
  assert.equal(promotes('v1.0.1', ['v2.0.0']), false);
  assert.equal(promotes('v1.10.9', ['v1.10.10']), false);
  assert.equal(promotes('v2.0.0', ['v10.0.0']), false);
});

test('version components are compared numerically and reruns can promote latest', () => {
  assert.equal(promotes('v1.10.0', ['v1.9.9']), true);
  assert.equal(promotes('v2.0.0', ['v1.99.99', 'v2.0.0']), true);
  assert.equal(promotes('v10.0.0', ['v2.0.0']), true);
});

test('prereleases, unrelated tags and invalid versions cannot block latest', () => {
  assert.equal(promotes('v1.0.0', [
    'v2.0.0-beta.1', 'v999', 'v01.0.0', 'v99.0.0+build',
    'v99.0.0-beta.01', `v${'9'.repeat(128)}.0.0`, 'backup',
  ]), true);
});

test('invalid versions are rejected before creating image tags', () => {
  for (const version of [
    'v1', 'v1.0', '1.0.0', 'v01.0.0', 'v1.02.0', 'v1.0.03',
    'v1.0.0-beta.01', 'v1.0.0-', 'v1.0.0+build', 'v1.0.0-beta_1', 'v1.0.0\n',
    `v1.0.0-${'a'.repeat(122)}`,
  ]) {
    assert.throws(() => tags(version), /Invalid version|leading zeros/);
  }
});

test('Docker tag length limit and large numeric components are handled exactly', () => {
  assert.doesNotThrow(() => parseVersion(`v1.0.0-${'a'.repeat(121)}`));
  assert.equal(promotes('v9007199254740992.0.0', ['v9007199254740993.0.0']), false);
});
