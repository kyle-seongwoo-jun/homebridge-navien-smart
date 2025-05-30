const debounceMap = new Map<string, NodeJS.Timeout>();

export const debounced = (callback: () => void, key: string, delay = 100) => {
  clearTimeout(debounceMap.get(key));
  const timeout = setTimeout(() => {
    debounceMap.delete(key);
    callback();
  }, delay);
  debounceMap.set(key, timeout);
};
