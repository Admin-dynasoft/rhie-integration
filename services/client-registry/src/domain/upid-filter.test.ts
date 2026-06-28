import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rhieSanitizeUpid, rhieUpidIsExcluded } from '@rhie/shared';

describe('upid filter (PHP parity)', () => {
  it('sanitizes whitespace and zero-width chars', () => {
    assert.equal(rhieSanitizeUpid(' 602645-3179-7909 '), '602645-3179-7909');
    assert.equal(rhieSanitizeUpid('602645\u200B-3179'), '602645-3179');
  });

  it('returns null for empty input', () => {
    assert.equal(rhieSanitizeUpid(null), null);
    assert.equal(rhieSanitizeUpid(''), null);
    assert.equal(rhieSanitizeUpid('   '), null);
  });

  it('excludes UP-prefixed temporary UPIDs', () => {
    assert.equal(rhieUpidIsExcluded('UP-12345'), true);
    assert.equal(rhieUpidIsExcluded('up-12345'), true);
    assert.equal(rhieUpidIsExcluded('602645-3179-7909'), false);
  });
});
