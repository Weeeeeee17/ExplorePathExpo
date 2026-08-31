import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('..', import.meta.url));
test('Metro reads all20 unchanged JPGs, including frame headers after512KiB', async () => {
  const rawSize = require('image-size');
  require('./metro-pet-image-reader.cjs')();
  const { getAssetData } = require('metro/private/Assets');
  let count = 0;
  for (const series of readdirSync(join(root, 'assets/pets'))) {
    for (const name of readdirSync(join(root, 'assets/pets', series))) {
      const relative = `assets/pets/${series}/${name}`, absolute = join(root, relative);
      const before = readFileSync(absolute), expected = rawSize(before);
      assert.equal(rawSize(absolute).width, expected.width, 'previously captured function also uses the patched handler');
      const asset = await getAssetData(absolute, relative, [], 'ios', '/assets');
      assert.equal(asset.width, expected.width); assert.equal(asset.height, expected.height);
      assert.ok(before.equals(readFileSync(absolute))); count++;
    }
  }
  assert.equal(count, 20);
});
