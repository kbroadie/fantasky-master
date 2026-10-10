// Profile faces: each photo is cropped to what the Profile card can show; eye and head are fractions of the crop (head: geometric mean of eye-to-chin and cheek-to-cheek), so every head renders the same size.

export function faceFor(series, key) {
  const g = GROUP[series], face = g?.faces[key];
  return face ? { src: face.src || g.src, ratio: face.ratio || g.ratio, ex: face.eye[0], ey: face.eye[1], head: face.head } : null;
}

const GROUP = {
  // Series 21: each contestant's own hero photo, not the group shot, so each
  // face carries its own src.
  21: {
    faces: {
      Amy: { src: "img/s21/amy.webp", ratio: 1010 / 1264, eye: [0.6986, 0.2153], head: 0.1597 },
      Armando: { src: "img/s21/armando.webp", ratio: 1054 / 1341, eye: [0.6845, 0.2196], head: 0.1708 },
      Joanna: { src: "img/s21/joanna.webp", ratio: 1078 / 1118, eye: [0.6893, 0.2649], head: 0.1683 },
      Joel: { src: "img/s21/joel.webp", ratio: 1038 / 1223, eye: [0.6777, 0.2421], head: 0.1748 },
      Kumail: { src: "img/s21/kumail.webp", ratio: 1040 / 1366, eye: [0.6804, 0.2158], head: 0.1731 },
    },
  },
  22: {
    // Cropped from the group photo: drawn whole it was ~3,200px wide and iPhone Safari wouldn't draw it
    faces: {
      Chloe: { src: "img/s22/chloe.webp", ratio: 981 / 870, eye: [0.7269, 0.2588], head: 0.1380 },
      Richard: { src: "img/s22/richard.webp", ratio: 970 / 1034, eye: [0.7255, 0.2134], head: 0.1368 },
      Nina: { src: "img/s22/nina.webp", ratio: 920 / 952, eye: [0.7249, 0.2196], head: 0.1368 },
      Isy: { src: "img/s22/isy.webp", ratio: 855 / 752, eye: [0.7255, 0.2583], head: 0.1368 },
      Matt: { src: "img/s22/matt.webp", ratio: 1135 / 1262, eye: [0.7253, 0.2041], head: 0.1369 },
    },
  },
};
