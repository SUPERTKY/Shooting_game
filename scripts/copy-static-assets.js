import { cp, mkdir } from 'node:fs/promises';

const staticDirectories = [
  'Prize',
  'Sound',
  'assets',
  'image',
  'tree',
];

await mkdir('dist', { recursive: true });

await Promise.all(staticDirectories.map((directory) => (
  cp(directory, `dist/${directory}`, { recursive: true })
)));
