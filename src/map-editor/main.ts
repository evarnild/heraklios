import type { TerrainType } from '../data/terrain';
import { TERRAIN_ORDER, TERRAIN_LABELS, TERRAIN_COLORS, hexToPixel } from '../ui/hexRender';
import { EditorState } from './editorState';
import { toMapTsSource, toSaveFile, fromSaveFile, type EditorSaveFile } from './serialize';
import { Camera } from './camera';
import { drawScene } from './render';
import { attachInput } from './input';

const STORAGE_KEY = 'heraklios-map-editor-autosave';

const setupForm = document.getElementById('setupForm')!;
const editorPanel = document.getElementById('editorPanel')!;
const colsInput = document.getElementById('cols') as HTMLInputElement;
const rowsInput = document.getElementById('rows') as HTMLInputElement;
const createBtn = document.getElementById('createBtn')!;
const paletteEl = document.getElementById('palette')!;
const riverModeBtn = document.getElementById('riverModeBtn')!;
const downloadBtn = document.getElementById('downloadMapBtn')!;
const exportBtn = document.getElementById('exportJsonBtn')!;
const importBtn = document.getElementById('importJsonBtn')!;
const newMapBtn = document.getElementById('newMapBtn')!;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const statusEl = document.getElementById('status')!;
const canvas = document.getElementById('canvas') as HTMLCanvasElement;

let state: EditorState;
let camera: Camera;
let activeTerrain: TerrainType = 'plain';
let riverMode = false;
let hoverAccessor: { getHover: () => import('./render').Hover } | null = null;

function setStatus(text: string): void {
  statusEl.textContent = text;
}

function saveAutosave(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSaveFile(state)));
  } catch {
    // storage full/unavailable — non-fatal, just skip autosave
  }
}

function loadAutosave(): EditorSaveFile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EditorSaveFile) : null;
  } catch {
    return null;
  }
}

function resizeCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}

function render(): void {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const hover = hoverAccessor?.getHover() ?? null;
  drawScene(ctx, state, camera, w, h, hover, riverMode);
}

function buildPalette(): void {
  paletteEl.innerHTML = '';
  for (const terrain of TERRAIN_ORDER) {
    const btn = document.createElement('button');
    btn.className = 'swatch' + (terrain === activeTerrain ? ' active' : '');
    btn.dataset.terrain = terrain;
    const swatch = document.createElement('span');
    swatch.className = 'swatch-color';
    swatch.style.background = `#${(TERRAIN_COLORS[terrain] ?? 0xff00ff).toString(16).padStart(6, '0')}`;
    const label = document.createElement('span');
    label.textContent = TERRAIN_LABELS[terrain] ?? terrain;
    btn.appendChild(swatch);
    btn.appendChild(label);
    btn.addEventListener('click', () => {
      activeTerrain = terrain;
      riverMode = false;
      riverModeBtn.classList.remove('active');
      for (const el of paletteEl.querySelectorAll('button')) el.classList.remove('active');
      btn.classList.add('active');
      render();
    });
    paletteEl.appendChild(btn);
  }
}

function centerCameraOnGrid(): void {
  const hexes = state.allHexes();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const hex of hexes) {
    const p = hexToPixel(hex);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  camera = new Camera((minX + maxX) / 2, (minY + maxY) / 2, 1);
}

function startEditor(newState: EditorState): void {
  state = newState;
  centerCameraOnGrid();
  setupForm.style.display = 'none';
  editorPanel.style.display = 'block';
  buildPalette();
  hoverAccessor = attachInput(canvas, state, camera, {
    getActiveTerrain: () => activeTerrain,
    isRiverMode: () => riverMode,
  }, () => {
    saveAutosave();
    render();
  });
  setStatus(`Carte ${state.cols} x ${state.rows} (${state.allHexes().length} hexagones).`);
  resizeCanvas();
}

createBtn.addEventListener('click', () => {
  const cols = Math.max(1, Math.min(80, parseInt(colsInput.value, 10) || 1));
  const rows = Math.max(1, Math.min(80, parseInt(rowsInput.value, 10) || 1));
  startEditor(new EditorState(cols, rows));
});

riverModeBtn.addEventListener('click', () => {
  riverMode = !riverMode;
  riverModeBtn.classList.toggle('active', riverMode);
  render();
});

downloadBtn.addEventListener('click', () => {
  const source = toMapTsSource(state);
  downloadFile('map.ts', source, 'text/typescript');
  setStatus('map.ts téléchargé — remplacez src/data/map.ts par ce fichier.');
});

exportBtn.addEventListener('click', () => {
  const json = JSON.stringify(toSaveFile(state), null, 2);
  downloadFile('heraklios-map.json', json, 'application/json');
  setStatus('Carte exportée en JSON.');
});

importBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text) as EditorSaveFile;
    startEditor(fromSaveFile(data));
    setStatus('Carte importée depuis ' + file.name + '.');
  } catch (err) {
    setStatus('Échec de l\'import : ' + String(err));
  }
  fileInput.value = '';
});

newMapBtn.addEventListener('click', () => {
  if (!confirm('Repartir sur une nouvelle carte vierge ? Les modifications non exportées seront perdues.')) return;
  editorPanel.style.display = 'none';
  setupForm.style.display = 'block';
});

function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

window.addEventListener('resize', resizeCanvas);

// Offer to restore an autosaved session on load.
const autosaved = loadAutosave();
if (autosaved && confirm(`Reprendre la session précédente (${autosaved.cols} x ${autosaved.rows}) ?`)) {
  startEditor(fromSaveFile(autosaved));
}
