const assert = require('assert');
const { collect, destinationFor, safeHttpUrl } = require('../extension/content.js');

// 1. Shape of X's embedded page state (user.entities.url.urls[])
const state = { entities: { users: { entities: { '1': { entities: { url: { urls: [
  { display_url: 'example.org', expanded_url: 'http://example.org', indices: [0, 23], url: 'https://t.co/KUHCeOrTNG' }
] } } } } } } };
const map = new Map();
collect(state, map);
assert.strictEqual(map.get('https://t.co/KUHCeOrTNG'), 'http://example.org/');

// 2. destinationFor
const m = new Map([['https://t.co/abc123', 'https://example.com/a?b=1']]);
assert.strictEqual(destinationFor('https://t.co/abc123', null, m), 'https://example.com/a?b=1');
assert.strictEqual(destinationFor('http://t.co/abc123', null, m), 'https://example.com/a?b=1');
assert.strictEqual(destinationFor('https://t.co/zzz', 'https://title.example/x', m), 'https://title.example/x');
assert.strictEqual(destinationFor('https://t.co/zzz', 'javascript:alert(1)', m), null);
assert.strictEqual(destinationFor('https://t.co/zzz', 'https://t.co/other', m), null);
assert.strictEqual(destinationFor('https://example.com/', 'https://x.y', m), null);
assert.strictEqual(destinationFor('https://t.co.evil.com/abc', 'https://x.y', m), null);

// 3. unsafe expanded_url never enters the map
const m2 = new Map();
collect({ a: [{ url: 'https://t.co/bad1', expanded_url: 'javascript:alert(1)' },
              { url: 'https://t.co/bad2', expanded_url: 'data:text/html,hi' },
              { url: 'https://t.co/loop', expanded_url: 'https://t.co/loop2' },
              { url: 'https://t.co/ok1', expanded_url: 'https://ok.example/' }] }, m2);
assert.deepStrictEqual([...m2.keys()], ['https://t.co/ok1']);

// 4. cycles & depth
const cyc = { url: 'https://t.co/c1', expanded_url: 'https://c.example/' }; cyc.self = cyc;
const m3 = new Map(); collect(cyc, m3); assert.strictEqual(m3.size, 1);
console.log('all tests passed');
