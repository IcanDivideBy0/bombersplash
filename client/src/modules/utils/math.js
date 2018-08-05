import curry from "lodash.curry";

export const addVec = curry((v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y }));

export const lerp = (a, b, alpha) => a * (1 - alpha) + b * alpha;
export const lerpVec = (v1, v2, alpha) => ({
  x: lerp(v1.x, v2.x, alpha),
  y: lerp(v1.y, v2.y, alpha)
});

export const clamp = (min, max, value) => Math.min(Math.max(value, min), max);

export const normalize = (min, max, value) => (value - min) / (max - min);
