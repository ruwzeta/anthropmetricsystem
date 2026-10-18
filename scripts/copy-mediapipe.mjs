// Copies the MediaPipe WebAssembly runtime into public/ so the app serves it
// itself instead of depending on a CDN.
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const to = join(root, 'public', 'mediapipe');
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
