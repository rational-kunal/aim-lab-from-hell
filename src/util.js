/**
 * Returns random number between min (included) and max (included)
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
const randomNumber = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};
