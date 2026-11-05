// Pure JSON canvas model. Geometry is bounded to keep imported batches predictable.
export const HISTORY_LIMIT = 100;
const LIMIT = 1e6, MAX_POINTS = 10000, MAX_ELEMENTS = 10000;
const copy = value => JSON.parse(JSON.stringify(value));
const fail = (message, code = 'VALIDATION') => { throw Object.assign(new Error(message), { code }); };
const number = (n, name = 'coordinate') => { if (typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > LIMIT) fail(`Invalid ${name}`); return n; };
const identifier = id => { if (typeof id !== 'string' || !id.length || id.length > 200 || ['__proto__', 'constructor', 'prototype'].includes(id)) fail('Invalid id'); return id; };
const human = author => author === 'human' || author?.type === 'human' || author?.role === 'human';
function json(value) {
  const visit = (v, depth) => {
    if (depth > 30) fail('JSON nesting limit exceeded');
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
    if (typeof v === 'number') { if (!Number.isFinite(v)) fail('Nonfinite JSON number'); return; }
    if (Array.isArray(v)) { v.forEach(x => visit(x, depth + 1)); return; }
    if (typeof v !== 'object' || Object.getPrototypeOf(v) !== Object.prototype) fail('Expected plain JSON');
    for (const [key, val] of Object.entries(v)) { if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('Unsafe JSON key'); visit(val, depth + 1); }
  };
  visit(value, 0);
}
function rect(r) {
  if (!Array.isArray(r) || r.length !== 4) fail('Expected rect [x,y,w,h]');
  r.forEach(n => number(n));
  if (r[2] < 0 || r[3] < 0) fail('Negative size');
}
function points(p) {
  if (!Array.isArray(p) || p.length < 1 || p.length > MAX_POINTS) fail('Invalid points count');
  p.forEach(v => { if (!Array.isArray(v) || v.length !== 2) fail('Expected [x,y] point'); v.forEach(n => number(n)); });
}
function validate(d) {
  identifier(d.id);
  if (!Number.isSafeInteger(d.version) || d.version < 0) fail('Invalid version');
  for (const key of ['elements', 'annotations', 'pending', 'history', 'future']) if (!Array.isArray(d[key])) fail(`Missing ${key}`);
  if (d.elements.length > MAX_ELEMENTS || d.history.length > HISTORY_LIMIT || d.future.length > HISTORY_LIMIT) fail('Document limit exceeded');
  const ids = new Set();
  for (const e of d.elements) {
    identifier(e.id); if (ids.has(e.id)) fail('Duplicate element id'); ids.add(e.id);
    if (typeof e.kind !== 'string' || !e.kind) fail('Missing kind');
    rect(e.rect); if (e.points !== undefined) points(e.points);
    if (e.kind === 'path' && !e.points) fail('Path needs points');
    if (e.text !== undefined && typeof e.text !== 'string') fail('Invalid text');
  }
  for (const e of d.elements) {
    const seen = new Set([e.id]); let parent = e.parent;
    while (parent != null) {
      const p = d.elements.find(x => x.id === parent);
      if (!p || p.kind !== 'group' || seen.has(parent)) fail('Invalid group parent');
      seen.add(parent); parent = p.parent;
    }
  }
  for (const list of [d.annotations, d.pending]) {
    const seen = new Set();
    for (const item of list) { identifier(item.id); if (seen.has(item.id)) fail('Duplicate record id'); seen.add(item.id); }
  }
}
export function initialDocument(id = 'canvas') {
  identifier(id);
  return { id, version: 0, elements: [], annotations: [], pending: [], history: [], future: [] };
}
const content = d => copy({ version: d.version, elements: d.elements, annotations: d.annotations, pending: d.pending });
export function readSnapshot(doc) { json(doc); validate(doc); return copy(doc); }
export const read = readSnapshot;
const restore = (d, s) => { for (const k of ['elements', 'annotations', 'pending']) d[k] = copy(s[k]); };
const fresh = (d, prefix) => { let n = 1; const used = [...d.elements, ...d.annotations, ...d.pending]; while (used.some(e => e.id === `${prefix}-${n}`)) n++; return `${prefix}-${n}`; };
function get(d, id) { const e = d.elements.find(e => e.id === id); if (!e) fail(`Element not found: ${id}`, 'NOT_FOUND'); return e; }
function selected(d, op) { const ids = op.ids ?? (op.id ? [op.id] : []); if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) fail('Expected unique ids'); return ids.map(id => get(d, id)); }
function add(d, e) { if (d.elements.some(x => x.id === e.id)) fail(`Duplicate element id: ${e.id}`); d.elements.push(copy(e)); }
function descendants(d, ids) { const all = new Set(ids); let size; do { size = all.size; d.elements.forEach(e => { if (all.has(e.parent)) all.add(e.id); }); } while (all.size !== size); return all; }
function translate(d, es, dx, dy) {
  number(dx); number(dy);
  const ids = descendants(d, es.map(e => e.id));
  d.elements.forEach(e => { if (ids.has(e.id)) { e.rect[0] += dx; e.rect[1] += dy; } });
}
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
function distanceSquared(p, a, b) { const v = sub(b, a), l = dot(v, v), t = l ? Math.max(0, Math.min(1, dot(sub(p, a), v) / l)) : 0; const q = sub(p, lerp(a, b, t)); return dot(q, q); }
// World-space outline of a closed shape, so the eraser can cut rectangles and ellipses the same way as strokes.
function outline(e) {
  const [x, y, w, h] = e.rect;
  if (e.kind === 'ellipse' || e.kind === 'circle') {
    const cx = x + w / 2, cy = y + h / 2, rx = w / 2, ry = h / 2, pts = [];
    for (let i = 0; i <= 64; i++) { const a = Math.PI * 2 * i / 64; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    return pts;
  }
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
}
// Split at exact circle and capsule-side intersections; classify each resulting interval.
function erasePolyline(poly, sweep, radius) {
  const capsules = sweep.length === 1 ? [[sweep[0], sweep[0]]] : sweep.slice(1).map((p, i) => [sweep[i], p]);
  if (Math.max(1, poly.length - 1) * capsules.length > 250000) fail('Eraser complexity limit exceeded');
  const inside = p => capsules.some(([a, b]) => distanceSquared(p, a, b) < radius * radius - 1e-10);
  if (poly.length === 1) return inside(poly[0]) ? [] : [poly];
  if (poly.every(p => p[0] === poly[0][0] && p[1] === poly[0][1])) return inside(poly[0]) ? [] : [poly];
  const fragments = []; let current = [], removed = false;
  const flush = () => { if (current.length > 1) fragments.push(current); current = []; };
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1], b = poly[i], v = sub(b, a), vv = dot(v, v), ts = [0, 1];
    if (vv === 0) continue;
    for (const [c, end] of capsules) {
      for (const center of [c, end]) {
        const q = sub(a, center), qb = 2 * dot(q, v), qc = dot(q, q) - radius * radius, disc = qb * qb - 4 * vv * qc;
        if (disc >= 0) for (const t of [(-qb - Math.sqrt(disc)) / (2 * vv), (-qb + Math.sqrt(disc)) / (2 * vv)]) if (t > 0 && t < 1) ts.push(t);
      }
      const axis = sub(end, c), length = Math.hypot(...axis);
      if (length) {
        const n = [-axis[1] / length, axis[0] / length], den = dot(v, n);
        if (den) for (const sign of [-1, 1]) { const t = (sign * radius - dot(sub(a, c), n)) / den; if (t > 0 && t < 1) ts.push(t); }
      }
    }
    ts.sort((x, y) => x - y);
    for (let j = 1; j < ts.length; j++) {
      const lo = ts[j - 1], hi = ts[j]; if (hi - lo < 1e-12) continue;
      if (inside(lerp(a, b, (lo + hi) / 2))) { removed = true; flush(); }
      else { if (!current.length) current.push(lerp(a, b, lo)); current.push(lerp(a, b, hi)); }
    }
  }
  flush(); return removed ? fragments : [poly];
}
function execute(d, op, author, fragments) {
  const type = op.type ?? op.op;
  switch (type) {
    case 'create': add(d, op.element); break;
    case 'createPath': {
      const e = op.element ?? { id: op.id ?? fresh(d, 'path'), kind: 'path', rect: op.rect ?? [0, 0, 0, 0], points: op.points, ...(op.stroke !== undefined ? { stroke: op.stroke } : {}), ...(op.parent ? { parent: op.parent } : {}) };
      add(d, { ...e, kind: 'path' }); break;
    }
    case 'update': case 'updatePath': {
      const e = get(d, op.id), patch = op.patch ?? (type === 'updatePath' ? { points: op.points } : null);
      if (!patch || patch.id !== undefined || patch.kind !== undefined || (type === 'updatePath' && e.kind !== 'path')) fail('Invalid patch');
      Object.assign(e, copy(patch)); break;
    }
    case 'delete': { const ids = descendants(d, selected(d, op).map(e => e.id)); d.elements = d.elements.filter(e => !ids.has(e.id)); break; }
    case 'clear': { d.elements = []; d.annotations = []; d.pending = []; break; }
    case 'move': translate(d, selected(d, op), op.dx, op.dy); break;
    case 'resize': {
      const e = get(d, op.id), r = op.rect ?? [e.rect[0], e.rect[1], op.width, op.height]; rect(r);
      const old = e.rect;
      if (e.points) e.points = e.points.map(([x, y]) => [old[2] ? x * r[2] / old[2] : x, old[3] ? y * r[3] / old[3] : y]);
      if (e.kind === 'group') for (const child of d.elements) if (descendants(d, [e.id]).has(child.id) && child !== e) {
        const sx = old[2] ? r[2] / old[2] : 1, sy = old[3] ? r[3] / old[3] : 1;
        child.rect = [r[0] + (child.rect[0] - old[0]) * sx, r[1] + (child.rect[1] - old[1]) * sy, child.rect[2] * sx, child.rect[3] * sy];
        if (child.points) child.points = child.points.map(([x, y]) => [x * sx, y * sy]);
      }
      e.rect = copy(r); break;
    }
    case 'erasePath': {
      points(op.points); number(op.radius, 'radius'); if (op.radius <= 0) fail('Radius must be positive');
      const es = op.ids || op.id ? selected(d, op) : d.elements.filter(e => e.kind === 'path' || (e.kind !== 'group' && !e.parent && ['rect', 'note', 'text', 'ellipse', 'circle'].includes(e.kind)));
      for (const e of es) {
        if (e.kind === 'group') continue;
        // Paths erase their centreline; closed shapes erase their outline, which then survives as path fragments.
        const world = e.kind === 'path'
          ? e.points.map(([x, y]) => [x + e.rect[0], y + e.rect[1]])
          : outline(e);
        const parts = erasePolyline(world, op.points, op.radius + Math.max(0, Number(e.strokeWidth) || 0) / 2);
        if (JSON.stringify(parts) === JSON.stringify([world])) continue;
        const index = d.elements.indexOf(e); d.elements.splice(index, 1);
        const base = e.kind === 'path' ? e : { ...copy(e), kind: 'path', fill: 'none' };
        const replacements = parts.map((ps, i) => {
          const x = Math.min(...ps.map(p => p[0])), y = Math.min(...ps.map(p => p[1]));
          const item = { ...copy(base), id: i === 0 ? e.id : fresh(d, `${e.id}-fragment`), rect: [x, y, Math.max(...ps.map(p => p[0])) - x, Math.max(...ps.map(p => p[1])) - y], points: ps.map(p => [p[0] - x, p[1] - y]) };
          d.elements.push(item); return item;
        });
        d.elements = d.elements.filter(x => !replacements.includes(x)); d.elements.splice(index, 0, ...replacements);
        fragments[e.id] = replacements.map(x => x.id);
      }
      break;
    }
    case 'group': {
      const es = selected(d, { ids: op.ids }), id = op.groupId ?? op.id ?? fresh(d, 'group');
      const parent = es[0].parent; if (es.some(e => e.parent !== parent)) fail('Group members need a common parent');
      const x = Math.min(...es.map(e => e.rect[0])), y = Math.min(...es.map(e => e.rect[1]));
      add(d, { id, kind: 'group', rect: [x, y, Math.max(...es.map(e => e.rect[0] + e.rect[2])) - x, Math.max(...es.map(e => e.rect[1] + e.rect[3])) - y], ...(parent ? { parent } : {}) });
      es.forEach(e => { e.parent = id; }); break;
    }
    case 'ungroup': { const e = get(d, op.id); if (e.kind !== 'group') fail('Expected group'); d.elements.forEach(x => { if (x.parent === e.id) { if (e.parent) x.parent = e.parent; else delete x.parent; } }); d.elements.splice(d.elements.indexOf(e), 1); break; }
    case 'reorder': {
      const es = selected(d, op); d.elements = d.elements.filter(e => !es.includes(e));
      let index = op.index ?? (op.position === 'back' ? 0 : d.elements.length);
      if (!Number.isInteger(index) || index < 0 || index > d.elements.length) fail('Invalid reorder index'); d.elements.splice(index, 0, ...es); break;
    }
    case 'setText': case 'setRole': case 'setVariant': { const key = type.slice(3).toLowerCase(); const value = op[key] ?? op.value; if (typeof value !== 'string') fail(`Invalid ${key}`); selected(d, op).forEach(e => { e[key] = value; }); break; }
    case 'duplicate': case 'paste': {
      const es = type === 'paste' ? copy(op.elements) : copy(d.elements.filter(e => descendants(d, selected(d, op).map(x => x.id)).has(e.id)));
      if (!Array.isArray(es) || !es.length) fail('Empty clipboard'); const map = new Map();
      for (const e of es) { const id = op.idMap?.[e.id] ?? fresh(d, `${e.id}-copy`); if (map.has(e.id)) fail('Duplicate clipboard id'); map.set(e.id, id); add(d, { ...e, id }); }
      for (const e of es) { const target = get(d, map.get(e.id)); if (map.has(e.parent)) target.parent = map.get(e.parent); else if (type === 'paste') delete target.parent; target.rect[0] += op.dx ?? 20; target.rect[1] += op.dy ?? 20; }
      break;
    }
    case 'align': {
      const es = selected(d, op), mode = op.alignment ?? op.align ?? 'left';
      const left = Math.min(...es.map(e => e.rect[0])), top = Math.min(...es.map(e => e.rect[1])), right = Math.max(...es.map(e => e.rect[0] + e.rect[2])), bottom = Math.max(...es.map(e => e.rect[1] + e.rect[3]));
      for (const e of es) {
        const [x, y, w, h] = e.rect;
        const deltas = { left: [left - x, 0], right: [right - x - w, 0], center: [(left + right - w) / 2 - x, 0], top: [0, top - y], bottom: [0, bottom - y - h], middle: [0, (top + bottom - h) / 2 - y] };
        if (!deltas[mode]) fail('Invalid alignment'); translate(d, [e], ...deltas[mode]);
      }
      break;
    }
    case 'distribute': {
      const axis = op.axis ?? 'x'; if (!['x', 'y', 'horizontal', 'vertical'].includes(axis)) fail('Invalid axis');
      const k = axis === 'x' || axis === 'horizontal' ? 0 : 1, es = selected(d, op).sort((a, b) => a.rect[k] - b.rect[k]);
      if (es.length < 3) fail('Distribute needs three elements');
      const start = es[0].rect[k], end = es.at(-1).rect[k] + es.at(-1).rect[k + 2], gap = (end - start - es.reduce((sum, e) => sum + e.rect[k + 2], 0)) / (es.length - 1);
      let pos = start; es.forEach(e => { translate(d, [e], k === 0 ? pos - e.rect[k] : 0, k === 1 ? pos - e.rect[k] : 0); pos += e.rect[k + 2] + gap; }); break;
    }
    case 'promote': {
      const e = get(d, op.id), kind = op.to ?? op.targetKind ?? op.kind ?? 'button';
      if (typeof kind !== 'string' || !kind) fail('Invalid promotion');
      if (['circle', 'ellipse'].includes(e.kind) && !(human(author) && op.approved === true)) {
        d.pending.push({ id: op.pendingId ?? fresh(d, 'consultation'), type: 'consultation', status: 'open', elementId: e.id, message: op.message ?? 'Promote this circle?', operation: { type: 'promote', id: e.id, to: kind }, author: copy(author) });
      } else { e.kind = kind; if (op.role) e.role = op.role; if (op.variant) e.variant = op.variant; }
      break;
    }
    case 'annotate': { const a = op.annotation ?? { id: op.id ?? fresh(d, 'annotation'), elementId: op.elementId ?? null, text: op.text, status: 'open', author: copy(author) }; if (a.elementId != null) get(d, a.elementId); if (typeof a.text !== 'string') fail('Annotation needs text'); d.annotations.push(copy(a)); break; }
    case 'resolveAnnotation': { const a = d.annotations.find(a => a.id === op.id); if (!a) fail('Annotation not found', 'NOT_FOUND'); a.status = 'resolved'; a.resolvedBy = copy(author); break; }
    case 'raisePending': { const p = copy(op.pending ?? { id: op.id ?? fresh(d, 'pending'), type: op.kind ?? 'consultation', message: op.message ?? '', ...(op.operation ? { operation: op.operation } : {}) }); p.status = 'open'; p.author = copy(author); d.pending.push(p); break; }
    case 'resolvePending': {
      const p = d.pending.find(p => p.id === op.id); if (!p || p.status !== 'open') fail('Open pending record not found', 'NOT_FOUND');
      const approval = op.approved ?? (op.resolution !== 'rejected' && op.resolution !== 'reject');
      if (approval && p.type === 'consultation' && !human(author)) fail('Only a human may approve consultation', 'FORBIDDEN');
      if (approval && p.operation) { if (p.operation.type !== 'promote') fail('Unsupported pending action'); execute(d, { ...p.operation, approved: true }, author, fragments); }
      p.status = approval ? 'approved' : 'rejected'; p.resolvedBy = copy(author); break;
    }
    default: fail(`Unknown operation: ${type}`);
  }
}
/** Coordinates: rect is world-space; path points are relative to rect origin (including grouped paths).
 * One batch = one version and one undo step. Undo/redo/revertTo must be the only operation.
 * Snapshots retain content only, at most 100 per stack. All errors leave the input untouched.
 */
export function applyOperations(doc, baseVersion, ops, author = 'human') {
  json(doc); validate(doc); json(ops); json(author);
  if (baseVersion !== doc.version) fail(`Version conflict: expected ${doc.version}, got ${baseVersion}`, 'VERSION_CONFLICT');
  if (!Array.isArray(ops) || ops.length > 1000) fail('Invalid batch');
  if (!ops.length) return { document: copy(doc), version: doc.version, applied: [], diff: { created: [], updated: [], deleted: [] }, fragments: {} };
  const d = copy(doc), before = content(d), fragments = {}, special = new Set(['undo', 'redo', 'revertTo']);
  if (ops.some(op => special.has(op.type ?? op.op))) {
    if (ops.length !== 1) fail('History operation must be a separate batch');
    const op = ops[0], type = op.type ?? op.op;
    if (type === 'undo' || type === 'redo') {
      const source = type === 'undo' ? d.history : d.future, target = type === 'undo' ? d.future : d.history;
      if (!source.length) fail(`Nothing to ${type}`, 'HISTORY_UNAVAILABLE');
      target.push(before); restore(d, source.pop());
    } else {
      const version = op.version ?? op.targetVersion;
      const target = version === d.version ? before : [...d.history, ...d.future].find(s => s.version === version);
      if (!target) fail(`Version ${version} is outside retained history (limit ${HISTORY_LIMIT})`, 'HISTORY_UNAVAILABLE');
      d.history.push(before); d.future = []; restore(d, target);
    }
  } else {
    for (const op of ops) { if (!op || typeof op !== 'object') fail('Invalid operation'); execute(d, op, author, fragments); validate(d); }
    d.history.push(before); d.future = [];
  }
  d.history = d.history.slice(-HISTORY_LIMIT); d.future = d.future.slice(-HISTORY_LIMIT); d.version = doc.version + 1;
  if (!Number.isSafeInteger(d.version)) fail('Version overflow'); validate(d);
  const previous = new Map(doc.elements.map(e => [e.id, e])), next = new Map(d.elements.map(e => [e.id, e]));
  const diff = {
    created: d.elements.filter(e => !previous.has(e.id)).map(e => e.id),
    updated: d.elements.filter(e => previous.has(e.id) && JSON.stringify(e) !== JSON.stringify(previous.get(e.id))).map(e => e.id),
    deleted: doc.elements.filter(e => !next.has(e.id)).map(e => e.id),
    annotationsChanged: JSON.stringify(doc.annotations) !== JSON.stringify(d.annotations),
    pendingChanged: JSON.stringify(doc.pending) !== JSON.stringify(d.pending),
    orderChanged: JSON.stringify(doc.elements.map(e => e.id)) !== JSON.stringify(d.elements.map(e => e.id))
  };
  return { document: d, version: d.version, applied: copy(ops), diff, fragments };
}
