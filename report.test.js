'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildReport } = require('./report');

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));

const upd = (event_id, task, status, revision, order_id = 'A') =>
  ({ event_id, order_id, task, status, revision });

const run = (updates, orders = [{ order_id: 'A', city: 'Pune' }]) =>
  buildReport({ orders, updates });

test('fixture: input.json matches expected.json', () => {
  assert.deepStrictEqual(buildReport(readJson('input.json')), readJson('expected.json'));
});

test('fixture: empty input matches empty expected', () => {
  assert.deepStrictEqual(buildReport(readJson('empty-input.json')), readJson('empty-expected.json'));
});

test('untouched order is blocked with all tasks pending', () => {
  const report = run([]);
  assert.deepStrictEqual(report.orders, [{
    order_id: 'A', city: 'Pune', status: 'blocked', completed_tasks: 0,
    pending_tasks: ['payment', 'site_survey', 'materials'],
  }]);
  assert.deepStrictEqual(report.summary, { total_orders: 1, ready: 0, blocked: 1 });
});

test('all tasks done makes the order ready', () => {
  const report = run([
    upd('e1', 'materials', 'done', 1),
    upd('e2', 'payment', 'done', 1),
    upd('e3', 'site_survey', 'done', 1),
  ]);
  assert.equal(report.orders[0].status, 'ready');
  assert.equal(report.orders[0].completed_tasks, 3);
  assert.deepStrictEqual(report.orders[0].pending_tasks, []);
  assert.deepStrictEqual(report.summary, { total_orders: 1, ready: 1, blocked: 0 });
});

test('each repeat of a valid event id counts as a duplicate and changes nothing', () => {
  const report = run([
    upd('e1', 'payment', 'done', 1),
    upd('e1', 'payment', 'done', 1),
    upd('e1', 'payment', 'done', 1),
  ]);
  assert.equal(report.duplicate_updates, 2);
  assert.equal(report.orders[0].completed_tasks, 1);
});

test('late older revision does not overwrite newer state and is not a duplicate', () => {
  const report = run([
    upd('e2', 'payment', 'done', 2),
    upd('e1', 'payment', 'pending', 1),
  ]);
  assert.equal(report.duplicate_updates, 0);
  assert.deepStrictEqual(report.orders[0].pending_tasks, ['site_survey', 'materials']);
});

test('higher-revision pending reopens a done task', () => {
  const report = run([
    upd('e1', 'payment', 'done', 1),
    upd('e2', 'site_survey', 'done', 1),
    upd('e3', 'materials', 'done', 1),
    upd('e4', 'materials', 'pending', 2),
  ]);
  assert.equal(report.orders[0].status, 'blocked');
  assert.deepStrictEqual(report.orders[0].pending_tasks, ['materials']);
});

test('invalid revisions are rejected as invalid_update', () => {
  const badRevisions = ['1', true, 0, -1, 1.5, null, undefined];
  const updates = badRevisions.map((r, i) => upd(`e${i}`, 'payment', 'done', r));
  const report = run(updates);
  assert.deepStrictEqual(
    report.rejected_updates,
    badRevisions.map((_, i) => ({ index: i, event_id: `e${i}`, reason: 'invalid_update' })),
  );
  assert.equal(report.orders[0].completed_tasks, 0);
});

test('invalid shapes, types and statuses are rejected; event_id null when not a non-empty string', () => {
  const report = run([
    null,
    'not an object',
    [1, 2],
    { order_id: 'A', task: 'payment', status: 'done', revision: 1 }, // missing event_id
    upd('   ', 'payment', 'done', 1),                                 // blank event_id
    upd(7, 'payment', 'done', 1),                                     // non-string event_id
    upd('e1', 'payment', 'DONE', 1),                                  // bad status
    upd('e2', '  ', 'done', 1),                                       // blank task
    upd('e3', 'payment', 'done', 1, ''),                              // blank order_id
  ]);
  assert.deepStrictEqual(report.rejected_updates, [
    { index: 0, event_id: null, reason: 'invalid_update' },
    { index: 1, event_id: null, reason: 'invalid_update' },
    { index: 2, event_id: null, reason: 'invalid_update' },
    { index: 3, event_id: null, reason: 'invalid_update' },
    { index: 4, event_id: null, reason: 'invalid_update' },
    { index: 5, event_id: null, reason: 'invalid_update' },
    { index: 6, event_id: 'e1', reason: 'invalid_update' },
    { index: 7, event_id: 'e2', reason: 'invalid_update' },
    { index: 8, event_id: 'e3', reason: 'invalid_update' },
  ]);
});

test('rejection precedence: invalid_update > unknown_order > unknown_task', () => {
  const report = run([
    upd('e1', 'roof_check', 'bogus', 1, 'NOPE'), // all wrong -> invalid_update
    upd('e2', 'roof_check', 'done', 1, 'NOPE'),  // unknown order and task -> unknown_order
    upd('e3', 'roof_check', 'done', 1),          // unknown task
  ]);
  assert.deepStrictEqual(report.rejected_updates.map((r) => r.reason),
    ['invalid_update', 'unknown_order', 'unknown_task']);
});

test('rejected updates do not enter the duplicate set', () => {
  const report = run([
    upd('e1', 'payment', 'done', '1'), // invalid
    upd('e1', 'payment', 'done', 1),   // first valid occurrence -> applied
  ]);
  assert.equal(report.duplicate_updates, 0);
  assert.equal(report.orders[0].completed_tasks, 1);
});

test('identifiers are used as supplied (no trimming for lookup)', () => {
  const report = run([upd('e1', 'payment', 'done', 1, ' A')]);
  assert.equal(report.rejected_updates[0].reason, 'unknown_order');
});

test('orders are sorted by order_id and unknown extra fields are ignored', () => {
  const report = run(
    [{ ...upd('e1', 'payment', 'done', 1, 'B'), source: 'crm' }],
    [{ order_id: 'B', city: 'X' }, { order_id: 'A', city: 'Y' }],
  );
  assert.deepStrictEqual(report.orders.map((o) => o.order_id), ['A', 'B']);
  assert.equal(report.orders[1].completed_tasks, 1);
  assert.deepStrictEqual(report.rejected_updates, []);
});
