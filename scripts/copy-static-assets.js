import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';

// Keep this list aligned with the low-load runtime settings in src/main.js.
// Shipping only files requested by the presentation build keeps deployment uploads
// small and avoids making school networks inspect unused large 3D models.
const staticFiles = [
  'Prize/Prize_4.glb',
  'Prize/Prize_8.glb',
  'Prize/Prize_10.glb',
  'Sound/pop.mp3',
  'THIRD_PARTY_NOTICES.md',
  'assets/Table.glb',
  'assets/Tent.glb',
  'assets/launcher.glb',
  'assets/shelf.glb',
  'assets/token.glb',
  'assets/wall.glb',
  'image/Point.png',
  'image/action.png',
  'image/ring.png',
  'image/sky.jpg',
];

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

await Promise.all(staticFiles.map(async (file) => {
  const destination = `dist/${file}`;
  await mkdir(dirname(destination), { recursive: true });
  await cp(file, destination);
}));
