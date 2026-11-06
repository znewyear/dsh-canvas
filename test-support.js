// Minimal locale contract for component tests; dictionaries are registered by the real Client plugin.
export function createLocale(active = 'en') {
  const dictionaries = new Map(), listeners = new Set();
  let revision = 0;
  const notify = () => { revision++; for (const fn of listeners) fn(); };
  return {
    getLocale: () => ({ active, revision }),
    setLocale(value) { active = value; notify(); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    register(namespace, values) {
      dictionaries.set(namespace, values);
      notify();
      return () => { dictionaries.delete(namespace); notify(); };
    },
    bind: namespace => key => {
      const values = dictionaries.get(namespace);
      return values?.[active]?.[key] ?? values?.[active.split('-')[0]]?.[key] ?? values?.en?.[key] ?? key;
    }
  };
}
