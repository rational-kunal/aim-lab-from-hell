const shootFx = function (i) {
  var n = 1.6e4;
  var c = n / 7;
  if (i > n) return null;
  var q = Math.pow(t(i, n), 2.1);
  return (i < c ? (i + Math.sin(-i / 900) * 10) & 16 : i & 13) ? q : -q;
};

const missFx = function (i) {
  var n = 1e4;
  if (i > n) return null;
  var q = t(i, n);
  return Math.sin((i / 55) * Math.sin(i / 99) + Math.sin(i / 100)) * q;
};

const startFx = function (i) {
  var notes = [0, 4, 7, 12, undefined, 7, 12];
  var n = 3.5e4;
  if (i > n) return null;
  var idx = ((notes.length * i) / n) | 0;
  var note = notes[idx];
  if (note === undefined) return 0;
  var r = Math.pow(2, note / 12) * 0.8;
  var q = t((i * notes.length) % n, n);
  return (i * r) & 64 ? q : -q;
};

const overFx = function (i) {
  var n = 5e4;
  if (i > n) return null;
  return (Math.pow(i, 0.9) & 200 ? 1 : -1) * Math.pow(t(i, n), 3);
};

// Sound player
const t = (i, n) => (n - i) / n;
const A = new AudioContext();
const m = A.createBuffer(1, 96e3, 48e3);

function startSound(fx) {
  const b = m.getChannelData(0);
  for (i = 96e3; i--; ) b[i] = fx(i);
  const s = A.createBufferSource();
  s.buffer = m;
  s.connect(A.destination);
  s.start();
}

const sound = {
  /** Sound for game start */
  start: function () {
    startSound(startFx);
  },
  /** Sound for shoot */
  shoot: function () {
    startSound(shootFx);
  },
  /** Sound for miss */
  miss: function () {
    startSound(missFx);
  },
  /** Sound for game over */
  over: function () {
    startSound(overFx);
  },
};
