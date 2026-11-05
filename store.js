import { initialDocument, applyOperations, readSnapshot } from './engine.js';

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
      return {ok:true, document:readSnapshot(current), ...(sinceSeq === current.version ? {unchanged:true} : {})};
    },
    apply({doc = 'canvas', baseVersion, ops} = {}, author = 'ai') {
      const task = queue.then(async () => {
        const id = docId(doc), current = table.get(id) ?? initialDocument(id);
        const result = applyOperations(current, baseVersion, ops, author);
        await table.put(id, result.document);
        return {ok:true, ...result, document:readSnapshot(result.document)};
      });
      queue = task.catch(() => {});
      return task;
    }
  };
}

export function failure(error) {
  return {ok:false,error:{code:error?.code ?? 'CANVAS_ERROR',message:String(error?.message ?? error)}};
}
