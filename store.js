import { initialDocument, applyOperations, readSnapshot } from './engine.js';

// Undo/redo replays on the host; the UI only checks stack depth, so image bytes are not echoed inside history snapshots.
const lightSnapshot = snapshot => ({...snapshot, elements: snapshot.elements.map(e => e.kind === 'image' && typeof e.src === 'string' ? {...e, src: '[image data omitted]'} : e)});
const wire = document => ({...document, history: document.history.map(lightSnapshot), future: document.future.map(lightSnapshot)});

export function createStore(table) {
  let queue = Promise.resolve();
  function docId(value = 'canvas') {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value) || ['constructor','prototype','__proto__'].includes(value)) throw Object.assign(new Error('Document id must be 1–80 letters, digits, hyphens or underscores'), {code:'INVALID_DOCUMENT'});
    return value;
  }
  return {
    async read({doc = 'canvas', sinceSeq} = {}) {
      const id = docId(doc);
      await queue;
      const current = table.get(id) ?? initialDocument(id);
      // A poll that already knows the version gets a small acknowledgement instead of the whole document again.
      if (sinceSeq === current.version) return {ok:true, unchanged:true, version: current.version};
      return {ok:true, document: wire(readSnapshot(current))};
    },
    apply({doc = 'canvas', baseVersion, ops} = {}, author = 'ai') {
      const task = queue.then(async () => {
        const id = docId(doc), current = table.get(id) ?? initialDocument(id);
        const result = applyOperations(current, baseVersion, ops, author);
        await table.put(id, result.document);
        return {ok:true, ...result, document:wire(readSnapshot(result.document))};
      });
      queue = task.catch(() => {});
      return task;
    }
  };
}

export function failure(error) {
  return {ok:false,error:{code:error?.code ?? 'CANVAS_ERROR',message:String(error?.message ?? error)}};
}
