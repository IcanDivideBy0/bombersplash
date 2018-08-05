export default fn => {
  const cache = {};

  return (...args) => {
    const n = args[0];
    if (!(n in cache)) cache[n] = fn(...args);
    return cache[n];
  };
};
