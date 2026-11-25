import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Match GoThrough's release rules. Docker tags cannot contain '+build' metadata.
export function parseVersion(version) {
  const match = /^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version);
  if (!match || match[0] !== version || version.length > 128) throw new Error(`Invalid version: ${version}; use v1.0.0 or v1.0.0-beta.1`);
  const prerelease = match[4];
  if (prerelease?.split('.').some((part) => /^0[0-9]+$/.test(part))) {
    throw new Error('Numeric prerelease identifiers must not contain leading zeros');
  }
  return { numbers: match.slice(1, 4).map(BigInt), prerelease };
}

function compare(left, right) {
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] > right[index] ? 1 : -1;
  }
  return 0;
}

export function imageTags({ image, version, commit, knownVersions = [] }) {
  const current = parseVersion(version);
  const tags = [`${image}:${version}`, `${image}:sha-${commit}`];
  const hasNewerStable = knownVersions.some((tag) => {
    try {
      const other = parseVersion(tag);
      return !other.prerelease && compare(other.numbers, current.numbers) > 0;
    } catch {
      return false; // Unrelated or malformed Git tags do not affect latest.
    }
  });
  if (!current.prerelease && !hasNewerStable) tags.push(`${image}:latest`);
  return tags;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { IMAGE_NAME: image, VERSION: version, GITHUB_OUTPUT: output } = process.env;
    if (!image || !version || !output) throw new Error('IMAGE_NAME, VERSION and GITHUB_OUTPUT are required');
    const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
    const commit = git('rev-parse', 'HEAD');
    const tags = imageTags({ image, version, commit, knownVersions: git('tag', '--list').split(/\r?\n/) });
    appendFileSync(output, `commit=${commit}\ntags<<TRUST_IMAGE_TAGS\n${tags.join('\n')}\nTRUST_IMAGE_TAGS\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
