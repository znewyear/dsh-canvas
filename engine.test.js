import test from 'node:test';
import assert from 'node:assert/strict';
import { initialDocument, applyOperations, readSnapshot, HISTORY_LIMIT } from './engine.js';
const box = (id, x = 0, y = 0) => ({ id, kind: 'rect', rect: [x, y, 20, 10], stroke: '#222', fill: 'none' });
const run = (d, ops, author = 'human') => applyOperations(d, d.version, ops, author);
const seed = (...elements) => run(initialDocument(), elements.map(element => ({ type: 'create', element }))).document;

test('fragment eraser cuts closed shapes into path fragments', () => {
  const d = seed({ id: 'r', kind: 'rect', rect: [0, 0, 100, 60], stroke: '#222', strokeWidth: 2 });
  const out = run(d, [{ type: 'erasePath', points: [[50, 0]], radius: 5 }]);
  assert.ok(out.document.elements.length >= 1);
  assert.ok(out.document.elements.every(e => e.kind === 'path'));
  assert.equal(out.document.elements[0].id, 'r');
});

test('eraser radius includes the stroke half-width so thick lines erase cleanly', () => {
  const wide = { id: 'w', kind: 'path', rect: [0, 0, 100, 12], points: [[0, 6], [100, 6]], stroke: '#222', strokeWidth: 12 };
  const d = seed(wide);
  const out = run(d, [{ type: 'erasePath', points: [[50, 12]], radius: 2 }]);
  assert.equal(out.document.elements.length, 2);
  assert.ok(out.fragments.w && out.fragments.w.length === 2);
});

test('clear empties content as one undoable step', () => {
  let d = seed(box('a'), box('b', 80));
  d = run(d, [{ type: 'annotate', elementId: 'a', text: 'note' }]).document;
  d = run(d, [{ type: 'raisePending', message: 'decide' }]).document;
  assert.equal(d.annotations.length, 1); assert.equal(d.pending.length, 1);
  const cleared = run(d, [{ type: 'clear' }]);
  assert.deepEqual(cleared.document.elements, []);
  assert.deepEqual(cleared.document.annotations, []);
  assert.deepEqual(cleared.document.pending, []);
  assert.deepEqual(cleared.diff.deleted.sort(), ['a', 'b']);
  const undone = run(cleared.document, [{ type: 'undo' }]).document;
  assert.deepEqual(undone.elements.map(e => e.id), ['a', 'b']);
  assert.equal(undone.annotations.length, 1);
});

test('initial JSON, detached read, version conflict and atomic validation', () => {
  const d = initialDocument('test'); assert.deepEqual(d, { id: 'test', version: 0, elements: [], annotations: [], pending: [], history: [], future: [] });
  const snap = readSnapshot(d); snap.elements.push(box('x')); assert.equal(d.elements.length, 0);
  assert.throws(() => applyOperations(d, 9, [], 'ai'), { code: 'VERSION_CONFLICT' });
  for (const invalid of [[0, 0, -1, 2], [0, 0, Infinity, 2], [0, 0, 1e9, 2]]) {
    assert.throws(() => run(d, [{ type: 'create', element: box('good') }, { type: 'create', element: { ...box('bad'), rect: invalid } }]));
    assert.equal(d.elements.length, 0); assert.equal(d.version, 0);
  }
  assert.throws(() => run(d, [{ type: 'nonsense' }]));
  assert.throws(() => run(d, [{ type: 'create', element: box('a') }, { type: 'create', element: box('a') }]));
});

test('create/update/move/resize/text/role/variant/reorder/delete', () => {
  let d = seed(box('a'), box('b', 80));
  const result = run(d, [
    { type: 'update', id: 'a', patch: { fill: 'blue' } },
    { type: 'move', ids: ['a'], dx: 10, dy: 5 },
    { type: 'resize', id: 'a', rect: [10, 5, 40, 30] },
    { type: 'setText', id: 'a', text: 'Hello' },
    { type: 'setRole', id: 'a', role: 'button' },
    { type: 'setVariant', id: 'a', variant: 'primary' },
    { type: 'reorder', id: 'a', index: 1 }
  ]);
  assert.equal(result.version, 2); assert.equal(result.applied.length, 7); assert.deepEqual(result.diff.updated, ['a']);
  d = result.document; assert.equal(d.elements[1].text, 'Hello'); assert.deepEqual(d.elements[1].rect, [10, 5, 40, 30]);
  d = run(d, [{ type: 'delete', id: 'a' }]).document; assert.deepEqual(d.elements.map(e => e.id), ['b']);
});

test('path creation/update/resize uses local points', () => {
  let d = run(initialDocument(), [{ type: 'createPath', id: 'p', rect: [100, 50, 20, 20], points: [[0, 0], [20, 20]], stroke: 'red' }]).document;
  d = run(d, [{ type: 'updatePath', id: 'p', points: [[0, 0], [10, 20]] }, { type: 'resize', id: 'p', rect: [200, 100, 40, 40] }]).document;
  assert.deepEqual(d.elements[0].points, [[0, 0], [20, 40]]);
  assert.throws(() => run(d, [{ type: 'updatePath', id: 'p', points: [[NaN, 0]] }]));
});

test('circular eraser exactly splits segment and preserves style and group parent', () => {
  const d = seed({ id: 'g', kind: 'group', rect: [100, 20, 100, 10] }, { id: 'p', kind: 'path', parent: 'g', rect: [100, 20, 100, 0], points: [[0, 0], [100, 0]], stroke: { color: 'red', width: 3 }, fill: 'none' });
  const result = run(d, [{ type: 'erasePath', id: 'p', points: [[150, 20]], radius: 10 }]);
  assert.equal(result.fragments.p.length, 2);
  const parts = result.document.elements.filter(e => e.kind === 'path');
  assert.deepEqual(parts[0].rect, [100, 20, 40, 0]); assert.deepEqual(parts[1].rect, [160, 20, 40, 0]);
  assert.deepEqual(parts[0].points, [[0, 0], [40, 0]]); assert.equal(parts[1].parent, 'g'); assert.deepEqual(parts[1].stroke, d.elements[1].stroke);
  assert.equal(d.elements.length, 2);
});

test('swept eraser is a continuous capsule, not sparse point stamps', () => {
  const d = seed({ id: 'p', kind: 'path', rect: [0, 0, 100, 0], points: [[0, 0], [100, 0]] });
  const result = run(d, [{ type: 'erasePath', id: 'p', points: [[50, -100], [50, 100]], radius: 5 }]);
  const expected = [[0, 0, 45, 0], [55, 0, 45, 0]];
  result.document.elements.forEach((e, i) => e.rect.forEach((n, j) => assert.ok(Math.abs(n - expected[i][j]) < 1e-9)));
  const cleared = run(d, [{ type: 'erasePath', points: [[-10, 0], [110, 0]], radius: 5 }]);
  assert.deepEqual(cleared.fragments.p, []); assert.deepEqual(cleared.document.elements, []);
  const untouched = run(d, [{ type: 'erasePath', id: 'p', points: [[0, 100]], radius: 5 }]); assert.deepEqual(untouched.document.elements, d.elements);
});

test('polyline split reconnects surviving corners and handles degenerate points', () => {
  const d = seed({ id: 'p', kind: 'path', rect: [0, 0, 100, 100], points: [[0, 0], [0, 0], [100, 0], [100, 100]] });
  const result = run(d, [{ type: 'erasePath', id: 'p', points: [[50, 0]], radius: 10 }]);
  assert.equal(result.fragments.p.length, 2); assert.deepEqual(result.document.elements[1].points.at(-1), [40, 100]);
  const dot = seed({ id: 'dot', kind: 'path', rect: [20, 20, 0, 0], points: [[0, 0]] });
  assert.equal(run(dot, [{ type: 'erasePath', points: [[20, 20]], radius: 1 }]).document.elements.length, 0);
});

test('tangent and zero-length paths are unchanged outside the eraser', () => {
  for (const ps of [[[0, 0], [100, 0]], [[0, 0], [0, 0]]]) {
    const d = seed({ id: 'p', kind: 'path', rect: [0, 0, 100, 0], points: ps });
    const result = run(d, [{ type: 'erasePath', id: 'p', points: [[50, 10]], radius: 10 }]);
    assert.deepEqual(result.document.elements, d.elements); assert.deepEqual(result.fragments, {});
  }
});

test('group/ungroup moves world geometry once, duplicate remaps child parent, delete cascades', () => {
  let d = seed(box('a'), box('b', 30));
  d = run(d, [{ type: 'group', id: 'g', ids: ['a', 'b'] }, { type: 'move', ids: ['g', 'a'], dx: 10, dy: 20 }]).document;
  assert.deepEqual(d.elements.find(e => e.id === 'a').rect, [10, 20, 20, 10]);
  d = run(d, [{ type: 'duplicate', id: 'g', dx: 100, dy: 0 }]).document;
  assert.equal(d.elements.length, 6); assert.equal(d.elements.find(e => e.id === 'a-copy-1').parent, 'g-copy-1');
  d = run(d, [{ type: 'ungroup', id: 'g' }, { type: 'delete', id: 'g-copy-1' }]).document;
  assert.deepEqual(d.elements.map(e => e.id), ['a', 'b']); assert.equal(d.elements[0].parent, undefined);
  assert.throws(() => run(d, [{ type: 'update', id: 'a', patch: { parent: 'b' } }]));
});

test('paste/align/distribute and invalid geometry remains atomic', () => {
  let d = run(initialDocument(), [{ type: 'paste', elements: [box('a'), box('b', 30, 40), box('c', 100, 20)], dx: 0, dy: 0 }]).document;
  const ids = d.elements.map(e => e.id);
  d = run(d, [{ type: 'align', ids, alignment: 'top' }, { type: 'distribute', ids, axis: 'horizontal' }]).document;
  assert.deepEqual(d.elements.map(e => e.rect[1]), [0, 0, 0]); assert.deepEqual(d.elements.map(e => e.rect[0]), [0, 50, 100]);
  assert.throws(() => run(d, [{ type: 'move', ids, dx: 1e6, dy: 0 }]));
});

test('explicit circle promotion requires consultation approval by human', () => {
  let d = seed({ id: 'c', kind: 'circle', rect: [0, 0, 30, 30] });
  d = run(d, [{ type: 'promote', id: 'c', to: 'button' }], 'ai').document;
  assert.equal(d.elements[0].kind, 'circle'); assert.equal(d.pending.length, 1);
  const id = d.pending[0].id;
  assert.throws(() => run(d, [{ type: 'resolvePending', id, approved: true }], 'ai'), { code: 'FORBIDDEN' });
  d = run(d, [{ type: 'resolvePending', id, approved: true }], 'human').document;
  assert.equal(d.elements[0].kind, 'button'); assert.equal(d.pending[0].status, 'approved');
  const ordinary = seed(box('r'));
  assert.equal(run(ordinary, [{ type: 'promote', id: 'r', to: 'card' }], 'ai').document.elements[0].kind, 'card');
  const circle = seed({ id: 'c', kind: 'circle', rect: [0, 0, 30, 30] });
  assert.equal(run(circle, [{ type: 'promote', id: 'c', to: 'button', approved: true }], 'ai').document.elements[0].kind, 'circle');
  assert.equal(run(circle, [{ type: 'promote', id: 'c', to: 'button', approved: true }], 'human').document.elements[0].kind, 'button');
  d = run(d, [{ type: 'raisePending', id: 'q', message: 'A suggestion' }, { type: 'annotate', id: 'a', elementId: 'c', text: 'Check label' }], 'ai').document;
  d = run(d, [{ type: 'resolvePending', id: 'q', approved: false }, { type: 'resolveAnnotation', id: 'a' }], 'human').document;
  assert.equal(d.pending[1].status, 'rejected'); assert.equal(d.annotations[0].status, 'resolved');
});

test('all pending kinds require human approval, including custom records', () => {
  for (const pending of [
    { type: 'raisePending', id: 'q', kind: 'custom', message: 'Confirm this' },
    { type: 'raisePending', pending: { id: 'q', type: 'custom', message: 'Confirm this' } }
  ]) {
    const d = run(initialDocument(), [pending], 'ai').document;
    for (const resolution of [{ approved: true }, { resolution: 'approved' }, {}]) {
      assert.throws(() => run(d, [{ type: 'resolvePending', id: 'q', ...resolution }], 'ai'), { code: 'FORBIDDEN' });
    }
    assert.equal(d.pending[0].status, 'open');
    assert.equal(run(d, [{ type: 'resolvePending', id: 'q', approved: false }], 'ai').document.pending[0].status, 'rejected');
    assert.equal(run(d, [{ type: 'resolvePending', id: 'q', approved: true }], 'human').document.pending[0].status, 'approved');
  }
});

test('undo and redo are cross-author content-only snapshots and branch clears redo', () => {
  let d = seed(box('a'));
  d = run(d, [{ type: 'move', id: 'a', dx: 20, dy: 0 }], 'ai').document;
  assert.deepEqual(Object.keys(d.history[0]).sort(), ['annotations', 'elements', 'pending', 'version']);
  d = run(d, [{ type: 'undo' }], 'human').document; assert.equal(d.elements[0].rect[0], 0); assert.equal(d.version, 3);
  d = run(d, [{ type: 'redo' }], 'ai').document; assert.equal(d.elements[0].rect[0], 20); assert.equal(d.version, 4);
  d = run(d, [{ type: 'undo' }]).document;
  d = run(d, [{ type: 'setText', id: 'a', text: 'branch' }]).document;
  assert.throws(() => run(d, [{ type: 'redo' }]), { code: 'HISTORY_UNAVAILABLE' });
  assert.throws(() => run(d, [{ type: 'undo' }, { type: 'delete', id: 'a' }]));
});

test('history retains exactly 100 and revert reports unavailable versions', () => {
  let d = seed(box('a'));
  for (let i = 0; i < 110; i++) d = run(d, [{ type: 'move', id: 'a', dx: 1, dy: 0 }]).document;
  assert.equal(d.history.length, HISTORY_LIMIT); assert.equal(d.history[0].version, 11);
  assert.throws(() => run(d, [{ type: 'revertTo', version: 1 }]), { code: 'HISTORY_UNAVAILABLE' });
  d = run(d, [{ type: 'revertTo', version: 11 }]).document; assert.equal(d.elements[0].rect[0], 10); assert.equal(d.version, 112);
  d = run(d, [{ type: 'undo' }]).document; assert.equal(d.elements[0].rect[0], 110);
});
