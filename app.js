/* ==========================================================
   Cuaderno de entreno · Puente de Vallecas
   Guarda todo en localStorage del navegador (no hay servidor).
   ========================================================== */

const STORAGE_KEYS = {
  photos: 'cuaderno.photos',
  weights: 'cuaderno.weights',
  workouts: 'cuaderno.workouts',
  shopping: 'cuaderno.shopping',
  planChecks: 'cuaderno.planChecks',
  foodLog: 'cuaderno.foodLog',
  folderImports: 'cuaderno.folderImports',
  menuPlan: 'cuaderno.menuPlan',
  menuPlanNext: 'cuaderno.menuPlanNext',
  menuHistory: 'cuaderno.menuHistory',
  goals: 'cuaderno.goals',
  planSeries: 'cuaderno.planSeries',
  planCompletions: 'cuaderno.planCompletions',
  completionCounted: 'cuaderno.completionCounted',
  autoLoggedKeys: 'cuaderno.autoLoggedKeys'
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('Error leyendo', key, e);
    return fallback;
  }
}
function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

let state = {
  photos: load(STORAGE_KEYS.photos, []),
  weights: load(STORAGE_KEYS.weights, []),
  workouts: load(STORAGE_KEYS.workouts, []),
  shopping: load(STORAGE_KEYS.shopping, []),
  foodLog: load(STORAGE_KEYS.foodLog, []),
  menuHistory: load(STORAGE_KEYS.menuHistory, [])
};

/* ---------- Helper: comprimir una imagen a base64 ---------- */
function compressImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- Modal para ver fotos en grande ---------- */
const photoModal = document.getElementById('photoModal');
const photoModalImg = document.getElementById('photoModalImg');
document.getElementById('photoModalClose').addEventListener('click', () => photoModal.classList.add('hidden'));
photoModal.addEventListener('click', (e) => { if (e.target === photoModal) photoModal.classList.add('hidden'); });
function openPhotoModal(src) {
  photoModalImg.src = src;
  photoModal.classList.remove('hidden');
}

/* ---------- NAVEGACIÓN ENTRE PESTAÑAS ---------- */
document.querySelectorAll('.tabbtn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabbtn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');

    // Un gráfico creado mientras su pestaña estaba oculta se queda sin
    // tamaño (Chart.js mide 0x0) — al cambiar de pestaña, se le pide
    // que recalcule su tamaño ahora que ya se ve.
    [weightChart, workoutChart, fatChartInstance, muscleChartInstance,
      workoutHistoryChartInstance, sessionsHistoryChartInstance,
      calorieIntakeChartInstance, proteinIntakeChartInstance, balanceChartInstance]
      .forEach(c => { if (c) c.resize(); });
  });
});

/* ---------- FOTOS DE PROGRESO ---------- */
const photoBtn = document.getElementById('photoBtn');
const photoInput = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
const photoStrip = document.getElementById('photoStrip');

photoBtn.addEventListener('click', () => photoInput.click());

photoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  // Comprimimos a un canvas para no llenar el localStorage de fotos enormes
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxSize = 480;
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      state.photos.unshift({ id: Date.now(), date: new Date().toISOString(), src: dataUrl });
      save(STORAGE_KEYS.photos, state.photos);
      renderPhotos();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  photoInput.value = '';
});

// Comprime cualquier imagen elegida a un dataURL pequeño (para no llenar localStorage)
function fileToCompressedDataUrl(file, maxSize = 480, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderPhotos() {
  if (state.photos.length) {
    photoPreview.innerHTML = `<img src="${state.photos[0].src}" alt="Última foto">`;
  } else {
    photoPreview.innerHTML = '＋';
  }
  photoStrip.innerHTML = state.photos
    .map(p => `<img src="${p.src}" title="${new Date(p.date).toLocaleDateString('es-ES')}">`)
    .join('');
}

/* ---------- CARPETAS DE FOTOS DEL MÓVIL (importar + OCR) ----------
   Conecta una carpeta real del teléfono y lee fotos nuevas para
   rellenar el formulario automáticamente. Solo funciona en
   Android + Chrome (File System Access API) — en iPhone/Safari no
   existe esta función del navegador, así que ahí se sigue subiendo
   la foto a mano con el botón de siempre. La lectura del número
   (OCR, con Tesseract.js) es un intento: puede fallar o acertar a
   medias, por eso siempre se puede revisar y corregir antes de
   guardar. No se envía ninguna foto a ningún servidor: todo se
   procesa en el propio navegador.
------------------------------------------------------------------- */
const supportsFolderPicker = 'showDirectoryPicker' in window;
let folderImports = load(STORAGE_KEYS.folderImports, { peso: [], entreno: [] });
const pendingFolderKeys = { peso: new Set(), entreno: new Set() };

function openFolderDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('cuaderno-carpetas', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveFolderHandle(type, handle) {
  const db = await openFolderDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(handle, type);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
async function getFolderHandle(type) {
  try {
    const db = await openFolderDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('handles', 'readonly');
      const req = tx.objectStore('handles').get(type);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Error leyendo carpeta guardada', e);
    return null;
  }
}
function markFolderFileImported(type, key) {
  folderImports[type].push(key);
  save(STORAGE_KEYS.folderImports, folderImports);
  pendingFolderKeys[type].delete(key);
}

// Intenta sacar peso y composición corporal del texto leído en la foto.
// Muchas apps de báscula ponen el peso total suelto (sin la palabra
// "peso" al lado) y dan el músculo en kg en vez de en % — por eso el
// peso tiene un plan B, y músculo/ósea no exigen ningún símbolo detrás.
function parseWeightOcr(text) {
  const norm = text.toLowerCase().replace(/,/g, '.');
  const num = '(\\d{1,4}(?:\\.\\d{1,2})?)';
  const result = {};
  // La grasa, el músculo y la masa ósea ya no exigen ningún símbolo
  // detrás — según la app/pantalla, cada scale las da en % o en kg.
  const patterns = {
    kg: new RegExp('peso[^0-9]{0,10}' + num),
    fat: new RegExp('gras[ao](?:\\s*corporal)?[^0-9]{0,10}' + num),
    muscle: new RegExp('m[uú]scul[oa][^0-9]{0,10}' + num),
    water: new RegExp('agua[^0-9%]{0,10}' + num + '\\s*%'),
    visceral: new RegExp('visceral[^0-9]{0,10}' + num),
    bone: new RegExp('[oó]se[a]?[^0-9]{0,10}' + num),
    protein: new RegExp('prote[ií]na[^0-9]{0,10}' + num),
    metabolism: new RegExp('metabolismo(?:\\s*basal)?[^0-9]{0,10}' + num)
  };
  for (const [key, re] of Object.entries(patterns)) {
    const m = norm.match(re);
    if (m) result[key] = parseFloat(m[1]);
  }
  // Si no encuentra la palabra "peso", coge el primer número seguido de
  // "kg" que no sea el de masa ósea ni músculo (para no confundirlos).
  if (result.kg == null) {
    const kgRe = new RegExp(num + '\\s*kg', 'g');
    let m;
    while ((m = kgRe.exec(norm))) {
      const before = norm.slice(Math.max(0, m.index - 15), m.index);
      if (/(ose|muscul)/.test(before)) continue;
      const val = parseFloat(m[1]);
      if (val >= 30 && val <= 200) { result.kg = val; break; }
    }
  }
  return result;
}

// Intenta sacar minutos y kcal del texto leído en la foto de un entreno
function parseWorkoutOcr(text) {
  const norm = text.toLowerCase().replace(/,/g, '.');
  const result = {};
  let m = norm.match(/(\d{1,3})\s*(?:min|minutos)/);
  if (m) result.minutes = parseInt(m[1], 10);
  m = norm.match(/(\d{2,4})\s*(?:kcal|cal)/);
  if (m) result.calories = parseInt(m[1], 10);
  return result;
}

// Muchas fotos de entreno (planes tipo calistenia/crossfit) vienen
// organizadas en bloques con un título destacado (WARM UP, HACK,
// EXTRAHACK, DRILLS...) y debajo los ejercicios de ese bloque. Esto
// intenta separarlos así, en vez de dar todo el texto en un bloque
// único — es una intuición sobre mayúsculas/palabras clave, revísalo.
function parseWorkoutBlocks(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const HEADER_HINTS = /warm ?up|hack|extra ?hack|drills|cool ?down|finisher|activation/i;
  const isHeader = (line) => {
    if (HEADER_HINTS.test(line)) return true;
    const letters = line.replace(/[^a-zA-Zá-úñÁ-ÚÑ]/g, '');
    if (letters.length < 5) return false;
    const upper = (letters.match(/[A-ZÁ-ÚÑ]/g) || []).length;
    return (upper / letters.length) > 0.8 && line.length <= 45;
  };
  const blocks = [];
  let current = null;
  lines.forEach(line => {
    if (isHeader(line)) {
      current = { title: line, items: [] };
      blocks.push(current);
    } else if (current) {
      current.items.push(line);
    }
  });
  return blocks;
}

async function scanFolder(type) {
  const statusEl = document.getElementById(type === 'peso' ? 'weightFolderStatus' : 'workoutFolderStatus');
  const handle = await getFolderHandle(type);
  if (!handle) return;

  let perm = await handle.queryPermission({ mode: 'read' });
  if (perm !== 'granted') perm = await handle.requestPermission({ mode: 'read' });
  if (perm !== 'granted') {
    statusEl.textContent = 'No has dado permiso para leer la carpeta.';
    return;
  }

  statusEl.textContent = 'Buscando fotos nuevas…';
  const found = [];
  for await (const entry of handle.values()) {
    if (entry.kind !== 'file' || !/\.(jpe?g|png|webp)$/i.test(entry.name)) continue;
    const file = await entry.getFile();
    const key = `${entry.name}|${file.size}|${file.lastModified}`;
    if (folderImports[type].includes(key) || pendingFolderKeys[type].has(key)) continue;
    found.push({ key, file });
  }
  found.sort((a, b) => a.file.lastModified - b.file.lastModified);

  statusEl.textContent = found.length
    ? `${found.length} foto(s) nueva(s) — revisa y guarda cada una abajo.`
    : 'No hay fotos nuevas en la carpeta.';

  for (const { key, file } of found) {
    pendingFolderKeys[type].add(key);
    addFolderReviewItem(type, key, file);
  }
}

async function addFolderReviewItem(type, key, file) {
  const queueEl = document.getElementById(type === 'peso' ? 'weightFolderQueue' : 'workoutFolderQueue');
  let dataUrl, ocrImageUrl;
  try {
    dataUrl = await fileToCompressedDataUrl(file, 640, 0.7);
    // Para leer el texto usamos una versión bastante más grande que la
    // miniatura que se guarda — con 640px las letras pequeñas de una
    // captura de pantalla se ven borrosas y el OCR falla mucho más.
    ocrImageUrl = await fileToCompressedDataUrl(file, 1600, 0.9);
  } catch (e) {
    console.error('No se pudo abrir la foto', file.name, e);
    return; // formato no soportado por el navegador (p.ej. algún .heic) — se reintentará en el próximo escaneo
  }

  const wrap = document.createElement('div');
  wrap.className = 'folder-review-item';
  wrap.innerHTML = `
    <img class="folder-review-thumb" src="${dataUrl}">
    <div class="folder-review-body">
      <span class="folder-review-name">${file.name}</span>
      <span class="folder-ocr-badge">🔎 Leyendo foto…</span>
      <div class="folder-review-fields"></div>
      <div class="folder-review-blocks"></div>
      <div class="folder-review-actions">
        <button type="button" class="btn btn-lime btn-sm" data-save>Guardar</button>
        <button type="button" class="btn btn-ghost btn-sm" data-discard>Descartar</button>
      </div>
      <details open><summary>Texto detectado (por si quieres leerlo tú)</summary><pre data-ocr-text>—</pre></details>
    </div>
  `;
  queueEl.appendChild(wrap);
  wrap.querySelector('.folder-review-thumb').addEventListener('click', () => openPhotoModal(dataUrl));
  wrap.querySelector('[data-discard]').addEventListener('click', () => {
    markFolderFileImported(type, key);
    wrap.remove();
  });

  const badgeEl = wrap.querySelector('.folder-ocr-badge');
  const fieldsEl = wrap.querySelector('.folder-review-fields');
  const blocksEl = wrap.querySelector('.folder-review-blocks');
  let ocrData = {};
  let workoutBlocks = [];
  try {
    const { data } = await Tesseract.recognize(ocrImageUrl, 'eng');
    wrap.querySelector('[data-ocr-text]').textContent = data.text.trim() || '(sin texto detectado)';
    ocrData = type === 'peso' ? parseWeightOcr(data.text || '') : parseWorkoutOcr(data.text || '');
    if (type === 'entreno') {
      workoutBlocks = parseWorkoutBlocks(data.text || '');
      if (workoutBlocks.length) {
        blocksEl.innerHTML = `
          <p class="menu-field-label">Bloques detectados (revísalos)</p>
          ${workoutBlocks.map(b => `
            <div class="workout-block">
              <p class="workout-block-title">${b.title}</p>
              <ul class="workout-block-items">${b.items.map(i => `<li>${i}</li>`).join('')}</ul>
            </div>
          `).join('')}
        `;
      }
    }
    badgeEl.textContent = Object.keys(ocrData).some(k => ocrData[k] != null) || workoutBlocks.length
      ? '✓ Datos detectados — revisa antes de guardar'
      : '⚠️ No detecté ningún número, rellénalo a mano';
  } catch (err) {
    console.error('Error de OCR', err);
    badgeEl.textContent = '⚠️ No se pudo leer la foto, rellena a mano';
  }

  if (type === 'peso') {
    fieldsEl.innerHTML = `
      <input type="number" step="0.1" data-field="kg" placeholder="Peso (kg)" value="${ocrData.kg ?? ''}">
      <input type="number" step="0.1" data-field="fat" placeholder="Grasa %" value="${ocrData.fat ?? ''}">
      <input type="number" step="0.1" data-field="muscle" placeholder="Músculo (kg o %)" value="${ocrData.muscle ?? ''}">
      <input type="number" step="0.1" data-field="water" placeholder="Agua %" value="${ocrData.water ?? ''}">
      <input type="number" step="0.1" data-field="visceral" placeholder="Visceral" value="${ocrData.visceral ?? ''}">
      <input type="number" step="0.01" data-field="bone" placeholder="Ósea (kg)" value="${ocrData.bone ?? ''}">
      <input type="number" step="0.1" data-field="protein" placeholder="Proteína %" value="${ocrData.protein ?? ''}">
      <input type="number" step="1" data-field="metabolism" placeholder="Metabolismo basal (kcal)" value="${ocrData.metabolism ?? ''}">
    `;
    wrap.querySelector('[data-save]').addEventListener('click', () => {
      const get = (f) => {
        const v = fieldsEl.querySelector(`[data-field="${f}"]`).value;
        return v !== '' ? parseFloat(v) : null;
      };
      const kg = get('kg');
      if (!kg) { alert('Pon al menos el peso antes de guardar.'); return; }
      state.weights.push({
        id: Date.now(),
        date: new Date(file.lastModified || Date.now()).toISOString(),
        kg, fat: get('fat'), muscle: get('muscle'), water: get('water'),
        visceral: get('visceral'), bone: get('bone'),
        protein: get('protein'), metabolism: get('metabolism'), photo: dataUrl
      });
      state.weights.sort((a, b) => new Date(a.date) - new Date(b.date));
      save(STORAGE_KEYS.weights, state.weights);
      renderWeights();
      markFolderFileImported(type, key);
      wrap.remove();
    });
  } else {
    fieldsEl.innerHTML = `
      <input type="text" data-field="sport" placeholder="Tipo de entreno" value="Entreno">
      <input type="number" data-field="minutes" placeholder="Minutos" value="${ocrData.minutes ?? ''}">
      <input type="number" data-field="calories" placeholder="Kcal" value="${ocrData.calories ?? ''}">
    `;
    wrap.querySelector('[data-save]').addEventListener('click', () => {
      const sport = fieldsEl.querySelector('[data-field="sport"]').value.trim() || 'Entreno';
      const minutes = parseInt(fieldsEl.querySelector('[data-field="minutes"]').value, 10);
      const calories = parseInt(fieldsEl.querySelector('[data-field="calories"]').value, 10);
      if (!minutes || !calories) { alert('Pon minutos y kcal antes de guardar.'); return; }
      // Cada línea de cada bloque se guarda como un ejercicio, con el
      // nombre del bloque delante (ej. "Warm up: Cat-cow Mobility") —
      // no hay kg porque son series/repes, no peso.
      const exercises = workoutBlocks.flatMap(b => b.items.map(item => ({
        name: `${b.title}: ${item}`, kg: null
      })));
      state.workouts.push({
        id: Date.now(),
        date: new Date(file.lastModified || Date.now()).toISOString(),
        sport, minutes, calories, exercises, photo: dataUrl
      });
      save(STORAGE_KEYS.workouts, state.workouts);
      renderWorkouts();
      markFolderFileImported(type, key);
      wrap.remove();
    });
  }
}

async function setupFolderConnector(type, connectBtnId, scanBtnId, statusId) {
  const connectBtn = document.getElementById(connectBtnId);
  const scanBtn = document.getElementById(scanBtnId);
  const statusEl = document.getElementById(statusId);

  if (!supportsFolderPicker) {
    connectBtn.disabled = true;
    connectBtn.textContent = 'No disponible en este navegador';
    statusEl.textContent = 'Conectar una carpeta solo funciona en Android con Chrome. En iPhone/Safari sigue usando el botón de adjuntar foto de arriba.';
    return;
  }

  async function refreshStatus() {
    const handle = await getFolderHandle(type);
    if (!handle) {
      statusEl.textContent = 'Ninguna carpeta conectada todavía.';
      scanBtn.classList.add('hidden');
      return;
    }
    scanBtn.classList.remove('hidden');
    const perm = await handle.queryPermission({ mode: 'read' });
    statusEl.textContent = perm === 'granted'
      ? `Carpeta conectada: "${handle.name}".`
      : `Carpeta "${handle.name}" conectada — pulsa "Buscar fotos nuevas" para reactivar el permiso.`;
  }

  connectBtn.addEventListener('click', async () => {
    try {
      const handle = await window.showDirectoryPicker();
      await saveFolderHandle(type, handle);
      await refreshStatus();
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Error conectando carpeta', err);
    }
  });

  scanBtn.addEventListener('click', () => scanFolder(type));

  await refreshStatus();
}

/* ---------- NUTRICIÓN: PESO ---------- */
const weightForm = document.getElementById('weightForm');
const weightInput = document.getElementById('weightInput');
const weightPhotoInput = document.getElementById('weightPhotoInput');
const weightPhotoName = document.getElementById('weightPhotoName');
const weightList = document.getElementById('weightList');
const weightEmpty = document.getElementById('weightEmpty');
let weightChart;
let pendingWeightPhoto = null;

weightPhotoInput.addEventListener('change', async () => {
  const file = weightPhotoInput.files[0];
  if (!file) return;
  pendingWeightPhoto = await compressImage(file, 640, 0.7);
  weightPhotoName.textContent = '✓ ' + file.name;
});

const TIPS = [
  'El desayuno no tiene que ser dulce: prueba con huevos y fruta.',
  'Bebe agua antes de las comidas, ayuda a controlar el hambre.',
  'Prioriza proteína en cada comida: huevos, legumbres, pollo, pescado.',
  'Las legumbres (lentejas, garbanzos) son baratas y muy saciantes.',
  'Duerme al menos 7 horas: el descanso afecta directamente al peso.',
  'No hace falta eliminar nada por completo, la clave es la cantidad.',
  'Lleva fruta o frutos secos para evitar picar ultraprocesados.',
  'Cocina de más los findes y congela raciones para entre semana.',
  'El aceite de oliva en crudo es mejor que las salsas industriales.',
  'Camina después de comer, ayuda a la digestión y al gasto calórico.'
];

document.getElementById('newTipBtn').addEventListener('click', showRandomTip);
function showRandomTip() {
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  document.getElementById('nutritionTip').textContent = tip;
}

weightForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const value = parseFloat(weightInput.value);
  if (!value) return;
  const entry = {
    id: Date.now(),
    date: new Date().toISOString(),
    kg: value,
    fat: parseFloat(document.getElementById('fatInput').value) || null,
    muscle: parseFloat(document.getElementById('muscleInput').value) || null,
    water: parseFloat(document.getElementById('waterInput').value) || null,
    visceral: parseFloat(document.getElementById('visceralInput').value) || null,
    bone: parseFloat(document.getElementById('boneInput').value) || null,
    protein: parseFloat(document.getElementById('proteinInput').value) || null,
    metabolism: parseFloat(document.getElementById('metabolismInput').value) || null,
    photo: pendingWeightPhoto
  };
  state.weights.push(entry);
  state.weights.sort((a, b) => new Date(a.date) - new Date(b.date));
  save(STORAGE_KEYS.weights, state.weights);
  weightForm.reset();
  pendingWeightPhoto = null;
  weightPhotoName.textContent = '';
  renderWeights();
});

/* Altura para calcular IMC */
const heightInput = document.getElementById('heightInput');
heightInput.value = load('cuaderno.height', '') || '';
document.getElementById('saveHeightBtn').addEventListener('click', () => {
  const h = parseFloat(heightInput.value);
  if (!h) return;
  save('cuaderno.height', h);
  renderWeights();
});
function getImc(kg) {
  const h = load('cuaderno.height', null);
  if (!h) return null;
  const m = h / 100;
  return (kg / (m * m)).toFixed(1);
}

function deleteWeight(id) {
  state.weights = state.weights.filter(w => w.id !== id);
  save(STORAGE_KEYS.weights, state.weights);
  renderWeights();
}

function renderWeights() {
  weightEmpty.style.display = state.weights.length ? 'none' : 'block';

  weightList.innerHTML = [...state.weights].reverse().map(w => {
    const imc = getImc(w.kg);
    const extras = [
      imc ? `IMC ${imc}` : '',
      w.fat != null ? `Grasa ${w.fat}%` : '',
      w.muscle != null ? `Músculo ${w.muscle}` : '',
      w.water != null ? `Agua ${w.water}%` : '',
      w.visceral != null ? `Visceral ${w.visceral}` : '',
      w.bone != null ? `Ósea ${w.bone}kg` : '',
      w.protein != null ? `Proteína ${w.protein}%` : '',
      w.metabolism != null ? `Metab. basal ${w.metabolism}kcal` : ''
    ].filter(Boolean).join(' · ');
    return `
    <li class="weight-entry">
      <div class="weight-entry-top">
        ${w.photo ? `<img class="log-thumb" src="${w.photo}" onclick="openPhotoModal('${w.photo}')">` : ''}
        <span>${new Date(w.date).toLocaleDateString('es-ES')}</span>
        <span class="val">${w.kg} kg</span>
        <button class="del" onclick="deleteWeight(${w.id})">✕</button>
      </div>
      ${extras ? `<div class="weight-entry-extras">${extras}</div>` : ''}
    </li>
  `;
  }).join('');

  const ctx = document.getElementById('weightChart');
  const labels = state.weights.map(w => new Date(w.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }));
  const data = state.weights.map(w => w.kg);

  if (weightChart) weightChart.destroy();
  weightChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: '#C6F135',
        backgroundColor: 'rgba(198,241,53,0.12)',
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#C6F135'
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8A9298', font: { size: 10 } }, grid: { color: '#2A3338' } },
        y: { ticks: { color: '#8A9298', font: { size: 10 } }, grid: { color: '#2A3338' } }
      }
    }
  });

  if (typeof renderGraficos === 'function' && state.goals) renderGraficos();
}

/* ---------- PLAN SEMANAL ---------- */
const WEEKLY_PLAN = [
  { key: 'lun', label: 'Lunes', types: [] },
  { key: 'mar', label: 'Martes', types: ['squat'] },
  { key: 'mie', label: 'Miércoles', types: [] },
  { key: 'jue', label: 'Jueves', types: ['squat'] },
  { key: 'vie', label: 'Viernes', types: ['gluteo'] },
  { key: 'sab', label: 'Sábado', types: ['gluteo', 'squat'] },
  { key: 'dom', label: 'Domingo', types: ['gluteo'] }
];

// Todos los bloques (glúteo, movilidad de sentadilla, movilidad de
// cadera) funcionan en series/rondas: al marcar el último ejercicio,
// si aún no llegaste al objetivo, se desmarca todo para la siguiente
// ronda y suma 1. El de glúteo son 4 (pediste 4, no 3); movilidad son
// 2 rondas por defecto — dímelo si quieres otro número.
const SERIES_TARGET = { gluteo: 4, squat: 2, hip: 2 };

// Al completar el objetivo de series de un bloque, se apunta solo un
// entreno con las kcal estimadas (con tu peso/metabolismo real si lo
// tienes), para que cuente en "Esta semana" y en los gráficos — antes
// marcar el plan como hecho no tenía ningún efecto en las calorías.
const AUTO_LOG_MET = { gluteo: 5, squat: 3, hip: 2.5 };
const AUTO_LOG_MINUTES = { gluteo: 30, squat: 12, hip: 10 };
const AUTO_LOG_SPORT = { gluteo: 'Glúteo (plan semanal)', squat: 'Movilidad sentadilla (plan)', hip: 'Movilidad cadera (plan)' };
let autoLoggedKeys = load(STORAGE_KEYS.autoLoggedKeys, []);

function autoLogPlanWorkout(listKey, typeKey) {
  if (autoLoggedKeys.includes(listKey)) return; // ya se apuntó por esta ronda de hoy
  const kg = getLastWeight();
  const met = AUTO_LOG_MET[typeKey] || 4;
  const minutes = AUTO_LOG_MINUTES[typeKey] || 15;
  const hours = minutes / 60;
  const bmr = estimateBMR(kg);
  const calories = bmr
    ? Math.round((bmr / 24) * hours + (met - 1) * kg * hours)
    : Math.round(met * kg * hours);
  state.workouts.push({
    id: Date.now(),
    date: new Date().toISOString(),
    sport: AUTO_LOG_SPORT[typeKey] || 'Plan semanal',
    minutes, calories, exercises: [], photo: null
  });
  save(STORAGE_KEYS.workouts, state.workouts);
  autoLoggedKeys.push(listKey);
  save(STORAGE_KEYS.autoLoggedKeys, autoLoggedKeys);
  renderWorkouts();
}

const PLAN_EXERCISES = {
  gluteo: {
    title: '💪 Glúteo · 4 series, descanso 45-60s',
    items: [
      'Búlgara sin peso, pie en la cama — 10-12 reps/pierna',
      'Sentadilla con goma sobre rodillas — 15-20 reps',
      'Puente de glúteo con goma en rodillas — 15-20 reps',
      'Patada de glúteo a 4 patas con goma en tobillos — 15 reps/pierna',
      'Peso muerto rumano con goma bajo los pies — 15 reps'
    ]
  },
  squat: {
    title: '⬇️ Movilidad para sentadilla profunda',
    items: [
      'Sentadilla profunda aguantada — 30-60s x3',
      'Estiramiento de tobillo contra pared — 10/lado',
      'Rock back de rana — 10 reps',
      'Sentadilla con pausa abajo (3s) — 8 reps'
    ]
  }
};

const MOBILITY_HIP = [
  'Círculos de cadera a 4 patas — 10/lado',
  'Estiramiento 90/90 — 1 min/lado',
  "World's greatest stretch — 5/lado",
  'Rana (frog stretch) — 1 min aguantando',
  'Balanceo de pierna adelante-atrás — 10/lado'
];

let planChecks = load(STORAGE_KEYS.planChecks, {});
// Series completadas hoy de glúteo (por día, se reinicia cada día nuevo)
let planSeries = load(STORAGE_KEYS.planSeries, {});
// Cuántas veces en total has completado cada rutina de movilidad (de por vida)
let planCompletions = load(STORAGE_KEYS.planCompletions, { squat: 0, hip: 0 });
// Qué días concretos ya se contaron, para no sumar dos veces el mismo día
let completionCounted = load(STORAGE_KEYS.completionCounted, []);

function getMondayOfCurrentWeek() {
  const d = new Date();
  const day = d.getDay() === 0 ? 7 : d.getDay(); // lunes = 1 ... domingo = 7
  d.setDate(d.getDate() - (day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}
function dateKeyForDayIndex(idx) {
  const monday = getMondayOfCurrentWeek();
  const d = new Date(monday);
  d.setDate(monday.getDate() + idx);
  return d.toISOString().slice(0, 10);
}
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

let selectedPlanDay = (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1); // índice 0=lunes

// Todos los checklists del plan funcionan igual: al marcar el último
// ejercicio de una ronda, si no has llegado al objetivo de series, se
// desmarca todo para la ronda siguiente y suma 1. Al llegar al
// objetivo: se queda marcado, suma 1 al contador de por vida, y se
// apunta un entreno automático con las kcal estimadas (una sola vez
// por día, aunque vuelvas a tocar los checks después).
function toggleCheck(listKey, itemIdx, totalItems, typeKey) {
  if (!planChecks[listKey]) planChecks[listKey] = [];
  const pos = planChecks[listKey].indexOf(itemIdx);
  if (pos === -1) planChecks[listKey].push(itemIdx);
  else planChecks[listKey].splice(pos, 1);

  const allChecked = totalItems && planChecks[listKey].length === totalItems;
  if (allChecked) {
    const target = SERIES_TARGET[typeKey] || 4;
    const done = planSeries[listKey] || 0;
    if (done < target) {
      planSeries[listKey] = done + 1;
      save(STORAGE_KEYS.planSeries, planSeries);
      if (planSeries[listKey] < target) {
        planChecks[listKey] = []; // ronda siguiente
      } else {
        // objetivo de series alcanzado hoy con este listKey
        if (!completionCounted.includes(listKey)) {
          completionCounted.push(listKey);
          planCompletions[typeKey] = (planCompletions[typeKey] || 0) + 1;
          save(STORAGE_KEYS.completionCounted, completionCounted);
          save(STORAGE_KEYS.planCompletions, planCompletions);
        }
        autoLogPlanWorkout(listKey, typeKey);
      }
    }
  }

  save(STORAGE_KEYS.planChecks, planChecks);
  renderPlan();
  renderMobility();
}

function renderCheckList(container, items, listKey, typeKey) {
  const checked = planChecks[listKey] || [];
  container.innerHTML = items.map((text, idx) => `
    <li class="${checked.includes(idx) ? 'plan-checked' : ''}">
      <button class="plan-check ${checked.includes(idx) ? 'checked' : ''}"
        onclick="toggleCheck('${listKey}', ${idx}, ${items.length}, '${typeKey}')"></button>
      <span class="plan-text">${text}</span>
    </li>
  `).join('');
}

function renderPlan() {
  const pillsEl = document.getElementById('weekPills');
  const dayLetters = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const todayIdx = (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);

  pillsEl.innerHTML = WEEKLY_PLAN.map((d, idx) => {
    const pillType = d.types[0] || 'descanso';
    return `
    <button class="week-pill type-${pillType} ${idx === selectedPlanDay ? 'selected' : ''}"
      onclick="selectPlanDay(${idx})">
      ${dayLetters[idx]}${idx === todayIdx ? ' •' : ''}
    </button>
  `;
  }).join('');

  const day = WEEKLY_PLAN[selectedPlanDay];
  const listEl = document.getElementById('planExerciseList');

  if (day.types.length === 0) {
    document.getElementById('planDayLabel').textContent = `${day.label} — 😴 Descanso de fuerza`;
    listEl.innerHTML = '<p class="plan-rest-msg">Sin ejercicios de glúteo ni movilidad de sentadilla. No olvides la movilidad de cadera de abajo.</p>';
    return;
  }

  document.getElementById('planDayLabel').textContent = `${day.label} — ${day.types.map(t => PLAN_EXERCISES[t].title).join(' + ')}`;
  const dateKey = dateKeyForDayIndex(selectedPlanDay);
  listEl.innerHTML = day.types.map(t => {
    const plan = PLAN_EXERCISES[t];
    const listKey = 'day-' + t + '-' + dateKey;
    const checked = planChecks[listKey] || [];
    const target = SERIES_TARGET[t] || 4;
    const items = plan.items.map((text, idx) => `
      <li class="${checked.includes(idx) ? 'plan-checked' : ''}">
        <button class="plan-check ${checked.includes(idx) ? 'checked' : ''}"
          onclick="toggleCheck('${listKey}', ${idx}, ${plan.items.length}, '${t}')"></button>
        <span class="plan-text">${text}</span>
      </li>
    `).join('');
    const counter = `<p class="plan-counter">Series de hoy: ${planSeries[listKey] || 0}/${target} ${(planSeries[listKey] || 0) >= target ? '🎉' : ''} · Hecho ${planCompletions[t] || 0} veces en total</p>`;
    return `<p class="plan-block-title">${plan.title}</p>${counter}<ul class="plan-list">${items}</ul>`;
  }).join('');
}

function selectPlanDay(idx) {
  selectedPlanDay = idx;
  renderPlan();
}

function renderMobility() {
  const listKey = 'mobility-hip-' + todayKey();
  document.getElementById('mobilityHipCounter').textContent =
    `Series de hoy: ${planSeries[listKey] || 0}/${SERIES_TARGET.hip} ${(planSeries[listKey] || 0) >= SERIES_TARGET.hip ? '🎉' : ''} · Hecho ${planCompletions.hip || 0} veces en total`;
  renderCheckList(document.getElementById('mobilityHipList'), MOBILITY_HIP, listKey, 'hip');
}

/* ---------- ENTRENOS (registro libre) ---------- */
const workoutForm = document.getElementById('workoutForm');
const workoutList = document.getElementById('workoutList');
const workoutPhotoInput = document.getElementById('workoutPhotoInput');
const workoutPhotoName = document.getElementById('workoutPhotoName');
const exerciseRows = document.getElementById('exerciseRows');
const caloriesInput = document.getElementById('caloriesInput');
const calorieHint = document.getElementById('calorieHint');
let workoutChart;
let pendingWorkoutPhoto = null;
let exerciseRowCount = 0;

workoutPhotoInput.addEventListener('change', async () => {
  const file = workoutPhotoInput.files[0];
  if (!file) return;
  pendingWorkoutPhoto = await compressImage(file, 640, 0.7);
  workoutPhotoName.textContent = '✓ ' + file.name;
});

function addExerciseRow() {
  exerciseRowCount++;
  const row = document.createElement('div');
  row.className = 'exercise-row';
  row.dataset.id = exerciseRowCount;
  row.innerHTML = `
    <input type="text" placeholder="Ejercicio (ej. Back squat)">
    <input type="number" step="0.5" placeholder="Kg" inputmode="decimal">
    <button type="button" class="del" onclick="this.closest('.exercise-row').remove()">✕</button>
  `;
  exerciseRows.appendChild(row);
}
document.getElementById('addExerciseBtn').addEventListener('click', addExerciseRow);

function getLastWeight() {
  if (!state.weights.length) return 65; // valor por defecto si aún no hay ningún peso registrado
  return state.weights[state.weights.length - 1].kg;
}

// Metabolismo basal (kcal/día) para personalizar el cálculo, en este
// orden de preferencia: 1) el que te da tu báscula (el más real),
// 2) estimado a partir de tu peso y tu % de grasa (fórmula Katch-McArdle),
// 3) estimado a partir de tu peso y tu altura (fórmula genérica, menos
// precisa porque no sabe tu edad exacta). Si no hay ningún dato, no se
// usa metabolismo y se cae en el cálculo simple de siempre.
function estimateBMR(kg) {
  const lastMetab = lastWeightWith('metabolism');
  if (lastMetab) return lastMetab.metabolism;
  const lastFat = lastWeightWith('fat');
  if (lastFat) return 370 + 21.6 * (kg * (1 - lastFat.fat / 100));
  const height = load('cuaderno.height', null);
  if (height) return 10 * kg + 6.25 * height - 5 * 30 - 78; // asume 30 años, sin dato de sexo
  return null;
}

function estimateCalories() {
  const select = document.getElementById('sportInput');
  const met = parseFloat(select.selectedOptions[0]?.dataset.met) || 6;
  const minutes = parseInt(document.getElementById('minutesInput').value, 10);
  if (!minutes) {
    calorieHint.textContent = 'Pon los minutos para poder calcular.';
    return null;
  }
  const kg = getLastWeight();
  const hours = minutes / 60;
  const bmr = estimateBMR(kg);
  let kcal, hint;
  if (bmr) {
    // Tu metabolismo basal repartido en esas horas, más el extra que
    // quemas por hacer ejercicio por encima de estar en reposo.
    kcal = Math.round((bmr / 24) * hours + (met - 1) * kg * hours);
    hint = `Estimado con tu peso (${kg} kg) y tu metabolismo basal (${Math.round(bmr)} kcal/día).`;
  } else {
    kcal = Math.round(met * kg * hours);
    hint = `Estimado solo con tu peso (${kg} kg). Añade tu altura en Nutrición o una medición con grasa% para un cálculo más preciso.`;
  }
  calorieHint.textContent = hint;
  return kcal;
}

document.getElementById('estimateCaloriesBtn').addEventListener('click', () => {
  const kcal = estimateCalories();
  if (kcal) caloriesInput.value = kcal;
});

workoutForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const sport = document.getElementById('sportInput').selectedOptions[0]?.textContent || '';
  const minutes = parseInt(document.getElementById('minutesInput').value, 10);
  let calories = parseInt(caloriesInput.value, 10);
  if (!calories) calories = estimateCalories();
  if (!sport || !minutes || !calories) return;

  const exercises = [...exerciseRows.querySelectorAll('.exercise-row')].map(row => {
    const [nameEl, kgEl] = row.querySelectorAll('input');
    return { name: nameEl.value.trim(), kg: kgEl.value ? parseFloat(kgEl.value) : null };
  }).filter(ex => ex.name);

  state.workouts.push({
    id: Date.now(), date: new Date().toISOString(), sport, minutes, calories,
    exercises, photo: pendingWorkoutPhoto
  });
  save(STORAGE_KEYS.workouts, state.workouts);
  workoutForm.reset();
  exerciseRows.innerHTML = '';
  calorieHint.textContent = '';
  pendingWorkoutPhoto = null;
  workoutPhotoName.textContent = '';
  renderWorkouts();
});

function deleteWorkout(id) {
  state.workouts = state.workouts.filter(w => w.id !== id);
  save(STORAGE_KEYS.workouts, state.workouts);
  renderWorkouts();
}

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay() === 0 ? 7 : date.getDay(); // lunes = 1
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (day - 1));
  return date;
}

function renderWorkouts() {
  workoutList.innerHTML = [...state.workouts].reverse().map(w => {
    const exList = (w.exercises && w.exercises.length)
      ? `<div class="weight-entry-extras">${w.exercises.map(ex => ex.kg ? `${ex.name} ${ex.kg}kg` : ex.name).join(' · ')}</div>`
      : '';
    return `
    <li class="weight-entry">
      <div class="weight-entry-top">
        ${w.photo ? `<img class="log-thumb" src="${w.photo}" onclick="openPhotoModal('${w.photo}')">` : ''}
        <span>${new Date(w.date).toLocaleDateString('es-ES')} · ${w.sport}</span>
        <span class="val">${w.calories} kcal</span>
        <button class="del" onclick="deleteWorkout(${w.id})">✕</button>
      </div>
      ${exList}
    </li>
  `;
  }).join('');

  const weekStart = startOfWeek(new Date());
  const thisWeek = state.workouts.filter(w => new Date(w.date) >= weekStart);
  document.getElementById('weekCalories').textContent = thisWeek.reduce((sum, w) => sum + w.calories, 0);
  document.getElementById('weekSessions').textContent = thisWeek.length;

  // Gráfico: kcal por día de la semana actual (lun-dom)
  const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  thisWeek.forEach(w => {
    const idx = (new Date(w.date).getDay() + 6) % 7; // lunes = 0
    dayTotals[idx] += w.calories;
  });

  const ctx = document.getElementById('workoutChart');
  if (workoutChart) workoutChart.destroy();
  workoutChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dayLabels,
      datasets: [{
        data: dayTotals,
        backgroundColor: '#FF6B4A',
        borderRadius: 4
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8A9298', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#8A9298', font: { size: 10 } }, grid: { color: '#2A3338' } }
      }
    }
  });

  if (typeof renderGraficos === 'function' && state.goals) renderGraficos();
}

/* ---------- MENÚ SEMANAL (editable, ingrediente a ingrediente) ----------
   El menú se guarda en localStorage para que lo puedas cambiar tú
   mismo cada semana sin tener que pedírmelo en el chat. Cada comida
   es una lista de ingredientes con su propia cantidad (no un gramaje
   total del plato), para poder añadir o quitar líneas libremente.
   Reglas que sigue el menú por defecto: comida siempre en tupper
   único, el pescado va solo en la cena, y como mucho un día de pasta.
------------------------------------------------------------------- */

// Plantilla genérica de repuesto (dieta orientada a perder grasa sin
// perder músculo: alta en proteína, carbohidratos controlados, y
// pensada para ahorrar — legumbres de base (garbanzos que ya tienes,
// lentejas) en vez de comprar más carne/pescado fresco, y aprovecha lo
// que ya tienes congelado (gulas, salmón) en vez de comprar más
// pescado fresco caro). Reglas fijas que pediste:
// - Nunca quinoa combinada con legumbres (muchas kcal/carbos juntas).
// - Lunes = jueves y martes = miércoles, siempre el mismo plato (cocina
//   de una vez, comes dos días de lo mismo) — así arranca cualquier
//   semana nueva, y si editas uno el emparejado se copia solo.
// - Plátano pre-entreno de lunes a jueves.
const DEFAULT_MENU_TEMPLATE = [
  {
    day: 'Lunes',
    comida: [
      { texto: 'Pechuga de pollo a la plancha', cantidad: '200 g' },
      { texto: 'Garbanzos', cantidad: '120 g' },
      { texto: 'Ensalada verde', cantidad: '100 g' },
      { texto: 'Plátano (pre-entreno)', cantidad: '1 ud' }
    ],
    cena: [
      { texto: 'Huevo (para gulas)', cantidad: '3 uds' },
      { texto: 'Gulas (congeladas)', cantidad: '100 g' }
    ]
  },
  {
    day: 'Martes',
    comida: [
      { texto: 'Lentejas estofadas', cantidad: '200 g' },
      { texto: 'Pechuga de pollo a la plancha', cantidad: '120 g' },
      { texto: 'Ensalada verde', cantidad: '100 g' },
      { texto: 'Plátano (pre-entreno)', cantidad: '1 ud' }
    ],
    cena: [
      { texto: 'Merluza al horno', cantidad: '200 g' },
      { texto: 'Brócoli al vapor', cantidad: '150 g' }
    ]
  },
  {
    day: 'Miércoles',
    comida: [
      { texto: 'Lentejas estofadas', cantidad: '200 g' },
      { texto: 'Pechuga de pollo a la plancha', cantidad: '120 g' },
      { texto: 'Ensalada verde', cantidad: '100 g' },
      { texto: 'Plátano (pre-entreno)', cantidad: '1 ud' }
    ],
    cena: [
      { texto: 'Merluza al horno', cantidad: '200 g' },
      { texto: 'Brócoli al vapor', cantidad: '150 g' }
    ]
  },
  {
    day: 'Jueves',
    comida: [
      { texto: 'Pechuga de pollo a la plancha', cantidad: '200 g' },
      { texto: 'Garbanzos', cantidad: '120 g' },
      { texto: 'Ensalada verde', cantidad: '100 g' },
      { texto: 'Plátano (pre-entreno)', cantidad: '1 ud' }
    ],
    cena: [
      { texto: 'Huevo (para gulas)', cantidad: '3 uds' },
      { texto: 'Gulas (congeladas)', cantidad: '100 g' }
    ]
  },
  {
    day: 'Viernes',
    comida: [
      { texto: 'Ensalada verde con atún', cantidad: '200 g' }
    ],
    cena: [
      { texto: 'Cena fuera / con planes — ajusta tú la cantidad', cantidad: '1 ud' }
    ]
  },
  {
    day: 'Sábado',
    comida: [
      { texto: 'Hamburguesa casera (sin pan)', cantidad: '200 g' },
      { texto: 'Boniato asado', cantidad: '100 g' },
      { texto: 'Ensalada verde', cantidad: '100 g' }
    ],
    cena: [
      { texto: 'Salmón al horno (congelado)', cantidad: '200 g' },
      { texto: 'Brócoli al vapor', cantidad: '150 g' }
    ]
  },
  {
    day: 'Domingo',
    comida: [
      { texto: 'Pisto con pollo', cantidad: '300 g' }
    ],
    cena: [
      { texto: 'Tortilla de claras con espinacas', cantidad: '3 uds' },
      { texto: 'Ensalada verde', cantidad: '100 g' }
    ]
  }
];

// Tu menú real de esta semana. Sin espárragos (caros y no tienes),
// más pimiento amarillo y cebolla, pollo en vez de pavo, berenjena
// blanca en chips al horno una noche. Albóndigas dos días (lunes y
// miércoles), solo tu ración — pon tú los gramos/uds reales que
// vayas a comer y las kcal/macros se recalculan solas. Dos días de
// pisto (jueves y sábado) para gastarlo, solo un día de salchichas
// congeladas. Domingo = hoy.
const THIS_WEEK_MENU = [
  {
    day: 'Lunes',
    comida: [
      { texto: 'Albóndigas caseras (tu ración)', cantidad: '4 uds' },
      { texto: 'Arroz blanco', cantidad: '200 g' },
      { texto: 'Pimiento amarillo y cebolla salteados', cantidad: '150 g' }
    ],
    cena: [
      { texto: 'Tortilla francesa (huevo)', cantidad: '3 uds' },
      { texto: 'Champiñones salteados', cantidad: '100 g' },
      { texto: 'Ensalada verde', cantidad: '100 g' }
    ]
  },
  {
    day: 'Martes',
    comida: [
      { texto: 'Chili casero proteico', cantidad: '300 g' },
      { texto: 'Arroz blanco', cantidad: '150 g' }
    ],
    cena: [
      { texto: 'Pollo a la plancha en tiras', cantidad: '150 g' },
      { texto: 'Pimiento amarillo y cebolla salteados', cantidad: '150 g' }
    ]
  },
  {
    day: 'Miércoles',
    comida: [
      { texto: 'Albóndigas caseras (tu ración)', cantidad: '4 uds' },
      { texto: 'Ñoquis salteados', cantidad: '300 g' },
      { texto: 'Pimiento amarillo y cebolla', cantidad: '150 g' }
    ],
    cena: [
      { texto: 'Salmón al horno (teletrabajo)', cantidad: '280 g' },
      { texto: 'Pimiento amarillo y cebolla al horno', cantidad: '150 g' }
    ]
  },
  {
    day: 'Jueves',
    comida: [
      { texto: 'Pisto de mamá con pollo', cantidad: '300 g' },
      { texto: 'Pollo desmenuzado', cantidad: '100 g' }
    ],
    cena: [
      { texto: 'Huevos revueltos', cantidad: '3 uds' },
      { texto: 'Chips de berenjena blanca al horno con especias', cantidad: '150 g' }
    ]
  },
  {
    day: 'Viernes',
    comida: [
      { texto: 'Lasaña casera 🍝 (único día con pasta de trigo)', cantidad: '350 g' }
    ],
    cena: [
      { texto: 'Salchichas a la plancha', cantidad: '200 g' },
      { texto: 'Pimiento amarillo y cebolla salteados', cantidad: '150 g' }
    ]
  },
  {
    day: 'Sábado',
    comida: [
      { texto: 'Pisto de mamá', cantidad: '300 g' },
      { texto: 'Huevo a la plancha', cantidad: '2 uds' }
    ],
    cena: [
      { texto: 'Crema de calabacín', cantidad: '300 ml' },
      { texto: 'Huevo duro', cantidad: '2 uds' }
    ]
  },
  {
    day: 'Domingo',
    comida: [
      { texto: 'Hamburguesa casera 🍔 (hoy)', cantidad: '2 uds' }
    ],
    cena: [
      { texto: 'Huevo (para gulas) 🍳 (hoy)', cantidad: '3 uds' },
      { texto: 'Gulas', cantidad: '100 g' }
    ]
  }
];

// Convierte un menú guardado con el formato antiguo (un plato + gramos
// por comida) al formato nuevo (lista de ingredientes), para que un
// menú ya guardado en el móvil no se rompa al actualizar la app.
function normalizeMenuPlan(plan) {
  const toList = (meal) => {
    if (Array.isArray(meal)) return meal.length ? meal : [{ texto: '', cantidad: '' }];
    if (meal && meal.texto) return [{ texto: meal.texto, cantidad: meal.gramos ? `${meal.gramos} g` : '' }];
    return [{ texto: '', cantidad: '' }];
  };
  return plan.map(d => ({ day: d.day, comida: toList(d.comida), cena: toList(d.cena) }));
}

// Dos semanas editables: la de esta semana y la de la que viene, para
// poder adelantarte y cambiar algo si no te gusta o ves que algo sale
// muy caro antes de que llegue esa semana. "next" arranca con la
// plantilla genérica hasta que la edites con lo que vayas a comer.
const menuWeeks = {
  current: normalizeMenuPlan(load(STORAGE_KEYS.menuPlan, null) || THIS_WEEK_MENU),
  next: normalizeMenuPlan(load(STORAGE_KEYS.menuPlanNext, null) || DEFAULT_MENU_TEMPLATE)
};
const MENU_WEEK_STORAGE_KEY = { current: STORAGE_KEYS.menuPlan, next: STORAGE_KEYS.menuPlanNext };
let activeMenuWeek = 'current';

function getMenuPlanState() { return menuWeeks[activeMenuWeek]; }
function saveMenuPlanState() { save(MENU_WEEK_STORAGE_KEY[activeMenuWeek], menuWeeks[activeMenuWeek]); }

// Diccionario aproximado (kcal/proteína/carbos/grasa por 100g) para poder
// calcular las kcal y macros del día a partir de los ingredientes y sus
// cantidades. Es una estimación (no lee etiquetas reales), y si un
// ingrediente no está aquí, o la cantidad no se puede convertir a gramos,
// se avisa en vez de dar un número inventado.
const NUTRITION_DB = [
  { keys: ['pollo'], kcal: 165, p: 31, c: 0, f: 3.6 },
  { keys: ['arroz'], kcal: 130, p: 2.7, c: 28, f: 0.3 },
  { keys: ['calabacin', 'calabacín'], kcal: 17, p: 1.2, c: 3.1, f: 0.3 },
  { keys: ['pimiento'], kcal: 31, p: 1, c: 6, f: 0.3 },
  { keys: ['cebolla'], kcal: 40, p: 1.1, c: 9, f: 0.1 },
  { keys: ['huevo'], kcal: 155, p: 13, c: 1.1, f: 11, gramsPerUnit: 60 },
  { keys: ['champin', 'champiñ'], kcal: 30, p: 3, c: 3.3, f: 1 },
  { keys: ['ensalada', 'lechuga'], kcal: 15, p: 1.2, c: 2.9, f: 0.2 },
  { keys: ['chili'], kcal: 150, p: 14, c: 10, f: 6 },
  { keys: ['albondiga', 'albóndiga'], kcal: 220, p: 15, c: 8, f: 14, gramsPerUnit: 30 },
  { keys: ['ñoqui', 'noqui'], kcal: 155, p: 3.5, c: 31, f: 2 },
  { keys: ['pisto'], kcal: 90, p: 1.5, c: 8, f: 6 },
  { keys: ['hamburguesa'], kcal: 250, p: 20, c: 0, f: 18, gramsPerUnit: 150 },
  { keys: ['lasaña', 'lasagna', 'lasana'], kcal: 190, p: 9, c: 16, f: 10 },
  { keys: ['salchicha'], kcal: 260, p: 12, c: 2, f: 23 },
  { keys: ['gulas'], kcal: 80, p: 11, c: 1, f: 3 },
  { keys: ['berenjena'], kcal: 25, p: 1, c: 6, f: 0.2 },
  { keys: ['crema'], kcal: 45, p: 1.5, c: 5, f: 2 },
  { keys: ['salmon', 'salmón'], kcal: 208, p: 20, c: 0, f: 13 },
  { keys: ['lenteja'], kcal: 116, p: 9, c: 20, f: 0.4 },
  { keys: ['garbanzo'], kcal: 164, p: 8.9, c: 27, f: 2.6 },
  { keys: ['atun', 'atún'], kcal: 116, p: 26, c: 0, f: 1 },
  { keys: ['queso'], kcal: 98, p: 11, c: 3.4, f: 4 },
  { keys: ['nuez', 'nueces'], kcal: 607, p: 20, c: 20, f: 54 },
  { keys: ['tomate'], kcal: 18, p: 0.9, c: 3.9, f: 0.2 },
  { keys: ['merluza'], kcal: 86, p: 17.8, c: 0, f: 1 },
  { keys: ['pescado blanco'], kcal: 90, p: 18, c: 0, f: 1.2 },
  { keys: ['quinoa'], kcal: 120, p: 4.4, c: 21, f: 1.9 },
  { keys: ['espinaca'], kcal: 23, p: 2.9, c: 3.6, f: 0.4 },
  { keys: ['brocoli', 'brócoli'], kcal: 34, p: 2.8, c: 7, f: 0.4 },
  { keys: ['platano', 'plátano'], kcal: 89, p: 1.1, c: 23, f: 0.3, gramsPerUnit: 120 },
  { keys: ['boniato', 'batata'], kcal: 90, p: 2, c: 20.5, f: 0.1 },
  { keys: ['clara'], kcal: 52, p: 11, c: 0.7, f: 0.2 }
];

function normalizeText(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Si el ingrediente combina varias cosas reconocidas (p.ej. "pimiento y
// cebolla") se promedian sus valores — es una mezcla, no una suma.
function matchFoodMacros(texto) {
  const norm = normalizeText(texto);
  const hits = NUTRITION_DB.filter(item => item.keys.some(k => norm.includes(normalizeText(k))));
  if (!hits.length) return null;
  const avg = (field) => hits.reduce((sum, h) => sum + h[field], 0) / hits.length;
  return { kcal: avg('kcal'), p: avg('p'), c: avg('c'), f: avg('f'), gramsPerUnit: hits[0].gramsPerUnit };
}

// Convierte "300 g" / "300 ml" / "3 uds" a gramos. Con unidades solo
// funciona si conocemos el peso aproximado de una unidad de ese alimento.
function parseCantidadGrams(cantidadTexto, gramsPerUnit) {
  const norm = (cantidadTexto || '').toLowerCase().trim();
  let m = norm.match(/^([\d.,]+)\s*(g|gr|gramos|ml)\b/);
  if (m) return parseFloat(m[1].replace(',', '.'));
  m = norm.match(/^([\d.,]+)\s*(uds?|unidades?|huevos?)\b/);
  if (m && gramsPerUnit) return parseFloat(m[1].replace(',', '.')) * gramsPerUnit;
  // Si has puesto solo el número, sin unidad detrás (p.ej. borraste la
  // "g" sin querer al editar), lo tratamos como gramos por defecto.
  m = norm.match(/^([\d.,]+)$/);
  if (m) return parseFloat(m[1].replace(',', '.'));
  return null;
}

function sumMealMacros(items, totals) {
  let ok = true;
  (items || []).forEach(ing => {
    if (!ing.texto || !ing.cantidad) return;
    const food = matchFoodMacros(ing.texto);
    if (!food) { ok = false; return; }
    const grams = parseCantidadGrams(ing.cantidad, food.gramsPerUnit);
    if (grams == null) { ok = false; return; }
    const ratio = grams / 100;
    totals.kcal += food.kcal * ratio;
    totals.p += food.p * ratio;
    totals.c += food.c * ratio;
    totals.f += food.f * ratio;
  });
  return ok;
}

function renderMealBlock(items, dayIdx, mealKey, label) {
  const rows = items.map((ing, itemIdx) => `
    <div class="menu-ingredient-row">
      <input type="text" class="menu-text-input" placeholder="Ingrediente"
        data-day="${dayIdx}" data-meal="${mealKey}" data-item="${itemIdx}" data-field="texto" value="${ing.texto}">
      <input type="text" class="menu-cantidad-input" placeholder="Cantidad"
        data-day="${dayIdx}" data-meal="${mealKey}" data-item="${itemIdx}" data-field="cantidad" value="${ing.cantidad}">
      <button type="button" class="del" data-remove-ingredient data-day="${dayIdx}" data-meal="${mealKey}" data-item="${itemIdx}">✕</button>
    </div>
  `).join('');
  return `
    <label class="menu-field-label ${mealKey === 'cena' ? 'cena' : ''}">${label}</label>
    ${rows}
    <button type="button" class="btn btn-ghost btn-sm" data-add-ingredient data-day="${dayIdx}" data-meal="${mealKey}">+ Añadir ingrediente</button>
  `;
}

function renderDayTotals(d, dayIdx) {
  const totals = { kcal: 0, p: 0, c: 0, f: 0 };
  const okComida = sumMealMacros(d.comida, totals);
  const okCena = sumMealMacros(d.cena, totals);
  const note = (okComida && okCena)
    ? ''
    : '<span class="menu-totals-note">* estimación aproximada — algún ingrediente o cantidad no se ha podido calcular (revísalo o dale un formato tipo "150 g")</span>';
  return `
    <div class="menu-day-totals" data-totals-for="${dayIdx}">
      🔥 <b>${Math.round(totals.kcal)} kcal</b> · P ${Math.round(totals.p)}g · C ${Math.round(totals.c)}g · G ${Math.round(totals.f)}g
      ${note}
    </div>
  `;
}

// Actualiza solo la cajita de kcal/macros de un día, sin reconstruir
// los campos — así nunca se pierde el foco ni lo que estás escribiendo.
function updateDayTotalsOnly(dayIdx) {
  const plan = getMenuPlanState();
  const el = document.querySelector(`.menu-day-totals[data-totals-for="${dayIdx}"]`);
  if (el && plan[dayIdx]) el.outerHTML = renderDayTotals(plan[dayIdx], dayIdx);
}

// Si el día editado tiene pareja (lunes/jueves, martes/miércoles) y esa
// pareja está en pantalla, refleja los mismos valores en sus campos sin
// reconstruir nada (mismo motivo: no perder el foco de lo que escribes).
function reflectMirroredDayInputs(weekId, dayIdx, mealKey) {
  if (weekId === 'current') return;
  const plan = menuWeeks[weekId];
  const dayName = plan[dayIdx] && plan[dayIdx].day;
  const linkedName = MENU_DAY_LINKS[dayName];
  if (!linkedName) return;
  const linkedIdx = plan.findIndex(d => d.day === linkedName);
  if (linkedIdx === -1) return;
  plan[linkedIdx][mealKey].forEach((ing, itemIdx) => {
    const textoInput = document.querySelector(`.menu-text-input[data-day="${linkedIdx}"][data-meal="${mealKey}"][data-item="${itemIdx}"]`);
    const cantidadInput = document.querySelector(`.menu-cantidad-input[data-day="${linkedIdx}"][data-meal="${mealKey}"][data-item="${itemIdx}"]`);
    if (textoInput) textoInput.value = ing.texto;
    if (cantidadInput) cantidadInput.value = ing.cantidad;
  });
  updateDayTotalsOnly(linkedIdx);
}

// Días que siempre quieres iguales (cocina de una vez, comes dos días
// el mismo plato): lunes = jueves, martes = miércoles. Se aplica a
// cualquier semana MENOS "esta semana" — a partir de la que viene, ya
// para siempre, según pediste. Si editas uno, el emparejado se copia solo.
const MENU_DAY_LINKS = { Lunes: 'Jueves', Jueves: 'Lunes', Martes: 'Miércoles', Miércoles: 'Martes' };

function mirrorLinkedDay(weekId, dayIdx, mealKey) {
  if (weekId === 'current') return;
  const plan = menuWeeks[weekId];
  const dayName = plan[dayIdx].day;
  const linkedName = MENU_DAY_LINKS[dayName];
  if (!linkedName) return;
  const linkedDay = plan.find(d => d.day === linkedName);
  if (!linkedDay) return;
  linkedDay[mealKey] = JSON.parse(JSON.stringify(plan[dayIdx][mealKey]));
}

function renderMenuPlan() {
  document.querySelectorAll('#menuWeekPills .week-pill').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.week === activeMenuWeek);
  });

  const plan = getMenuPlanState();
  document.getElementById('menuPlan').innerHTML = plan.map((d, dayIdx) => `
    <div class="menu-day">
      <div class="menu-day-title">${d.day}</div>
      ${renderMealBlock(d.comida, dayIdx, 'comida', 'Comida')}
      ${renderMealBlock(d.cena, dayIdx, 'cena', 'Cena')}
      ${renderDayTotals(d, dayIdx)}
    </div>
  `).join('');

  document.querySelectorAll('.menu-ingredient-row input').forEach(input => {
    // "input" (cada pulsación), no "change" (que solo salta al salir del
    // campo y en algunos móviles no llega a dispararse bien). Solo se
    // actualiza la cajita de kcal/macros y, si hay día pareja, sus
    // campos — nunca se reconstruye el campo que estás escribiendo, así
    // no se pierde el foco ni lo que llevas tecleado.
    input.addEventListener('input', () => {
      const { day, meal, item, field } = input.dataset;
      getMenuPlanState()[day][meal][item][field] = input.value;
      mirrorLinkedDay(activeMenuWeek, day, meal);
      saveMenuPlanState();
      updateDayTotalsOnly(day);
      reflectMirroredDayInputs(activeMenuWeek, day, meal);
    });
  });
  document.querySelectorAll('[data-add-ingredient]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { day, meal } = btn.dataset;
      getMenuPlanState()[day][meal].push({ texto: '', cantidad: '' });
      mirrorLinkedDay(activeMenuWeek, day, meal);
      saveMenuPlanState();
      renderMenuPlan();
    });
  });
  document.querySelectorAll('[data-remove-ingredient]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { day, meal, item } = btn.dataset;
      const meals = getMenuPlanState()[day][meal];
      meals.splice(item, 1);
      if (!meals.length) meals.push({ texto: '', cantidad: '' });
      mirrorLinkedDay(activeMenuWeek, day, meal);
      saveMenuPlanState();
      renderMenuPlan();
    });
  });
}

document.querySelectorAll('#menuWeekPills .week-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    activeMenuWeek = btn.dataset.week;
    renderMenuPlan();
  });
});

document.getElementById('resetMenuBtn').addEventListener('click', () => {
  if (!confirm('¿Restaurar la plantilla genérica de esta semana? Perderás el menú que has editado.')) return;
  menuWeeks[activeMenuWeek] = normalizeMenuPlan(JSON.parse(JSON.stringify(DEFAULT_MENU_TEMPLATE)));
  saveMenuPlanState();
  renderMenuPlan();
});

/* ---------- HISTORIAL DE MENÚS ----------
   "Esta semana" y "Semana que viene" son solo el plan vivo, editable.
   Para quedarte con un registro de lo que de verdad fuiste comiendo
   semana a semana, guarda aquí una foto fija de "Esta semana" cuando
   la termines (o cuando quieras).
------------------------------------------------------------------- */
document.getElementById('archiveMenuBtn').addEventListener('click', () => {
  const label = prompt('¿Qué semana es? (ej. "8-14 sept")', '');
  if (label === null) return;
  state.menuHistory.unshift({
    id: Date.now(),
    archivedAt: new Date().toISOString(),
    label: label.trim() || new Date().toLocaleDateString('es-ES'),
    days: JSON.parse(JSON.stringify(menuWeeks.current))
  });
  save(STORAGE_KEYS.menuHistory, state.menuHistory);
  renderMenuHistory();
  alert('Semana archivada en el historial.');
});

function deleteMenuHistory(id) {
  state.menuHistory = state.menuHistory.filter(m => m.id !== id);
  save(STORAGE_KEYS.menuHistory, state.menuHistory);
  renderMenuHistory();
}

function renderMenuHistory() {
  const listEl = document.getElementById('menuHistoryList');
  const emptyEl = document.getElementById('menuHistoryEmpty');
  if (!listEl) return;
  emptyEl.style.display = state.menuHistory.length ? 'none' : 'block';
  listEl.innerHTML = state.menuHistory.map(entry => `
    <details class="menu-history-entry">
      <summary>
        <span>${entry.label}</span>
        <button class="del" onclick="event.preventDefault(); deleteMenuHistory(${entry.id})">✕</button>
      </summary>
      ${entry.days.map(d => `
        <div class="menu-history-day">
          <b>${d.day}</b>
          · Comida: ${d.comida.map(i => i.texto).filter(Boolean).join(', ') || '—'}
          · Cena: ${d.cena.map(i => i.texto).filter(Boolean).join(', ') || '—'}
        </div>
      `).join('')}
    </details>
  `).join('');
}

/* ---------- DIARIO DE COMIDAS ---------- */
// Valores por cada 100g (aprox., fuente: tablas nutricionales estándar)
const FOOD_DB = [
  { name: 'Pollo pechuga (plancha)', kcal: 165, p: 31, c: 0, f: 3.6 },
  { name: 'Pavo pechuga', kcal: 135, p: 30, c: 0, f: 1 },
  { name: 'Atún en lata (natural)', kcal: 116, p: 26, c: 0, f: 1 },
  { name: 'Salmón', kcal: 208, p: 20, c: 0, f: 13 },
  { name: 'Merluza', kcal: 86, p: 17.8, c: 0, f: 1 },
  { name: 'Gambas', kcal: 99, p: 24, c: 0.2, f: 0.3 },
  { name: 'Huevo', kcal: 155, p: 13, c: 1.1, f: 11 },
  { name: 'Jamón de pavo/cocido', kcal: 104, p: 17, c: 1, f: 3 },
  { name: 'Chorizo', kcal: 455, p: 24, c: 1.9, f: 38 },
  { name: 'Arroz integral (cocido)', kcal: 123, p: 2.7, c: 25.8, f: 1 },
  { name: 'Arroz blanco (cocido)', kcal: 130, p: 2.7, c: 28, f: 0.3 },
  { name: 'Pasta integral (cocida)', kcal: 124, p: 5, c: 25, f: 1.1 },
  { name: 'Quinoa (cocida)', kcal: 120, p: 4.4, c: 21, f: 1.9 },
  { name: 'Patata (cocida)', kcal: 87, p: 1.9, c: 20, f: 0.1 },
  { name: 'Pan integral', kcal: 247, p: 13, c: 41, f: 3.4 },
  { name: 'Lentejas (cocidas)', kcal: 116, p: 9, c: 20, f: 0.4 },
  { name: 'Garbanzos (cocidos)', kcal: 164, p: 8.9, c: 27, f: 2.6 },
  { name: 'Judías verdes', kcal: 31, p: 1.8, c: 7, f: 0.1 },
  { name: 'Brócoli', kcal: 34, p: 2.8, c: 7, f: 0.4 },
  { name: 'Espinacas', kcal: 23, p: 2.9, c: 3.6, f: 0.4 },
  { name: 'Calabacín', kcal: 17, p: 1.2, c: 3.1, f: 0.3 },
  { name: 'Pimiento', kcal: 31, p: 1, c: 6, f: 0.3 },
  { name: 'Tomate', kcal: 18, p: 0.9, c: 3.9, f: 0.2 },
  { name: 'Champiñones', kcal: 22, p: 3.1, c: 3.3, f: 0.3 },
  { name: 'Espárragos', kcal: 20, p: 2.2, c: 3.9, f: 0.1 },
  { name: 'Aceite de oliva', kcal: 884, p: 0, c: 0, f: 100 },
  { name: 'Queso fresco', kcal: 98, p: 11, c: 3.4, f: 4 },
  { name: 'Yogur natural', kcal: 61, p: 3.5, c: 4.7, f: 3.3 },
  { name: 'Plátano', kcal: 89, p: 1.1, c: 23, f: 0.3 },
  { name: 'Manzana', kcal: 52, p: 0.3, c: 14, f: 0.2 },
  { name: 'Frutos secos (mix)', kcal: 607, p: 20, c: 20, f: 54 },
  { name: 'Galleta/pasta de té', kcal: 470, p: 6, c: 65, f: 20 },
  { name: 'Aguacate', kcal: 160, p: 2, c: 9, f: 15 },
  { name: 'Leche semidesnatada', kcal: 46, p: 3.3, c: 4.9, f: 1.6 }
];

const foodSelect = document.getElementById('foodSelect');
foodSelect.innerHTML = FOOD_DB.map((f, idx) => `<option value="${idx}">${f.name}</option>`).join('');

document.getElementById('toggleCustomFood').addEventListener('click', () => {
  document.getElementById('customFoodForm').classList.toggle('hidden');
});

document.getElementById('foodForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const food = FOOD_DB[parseInt(foodSelect.value, 10)];
  const grams = parseFloat(document.getElementById('foodGramsInput').value) || 100;
  const ratio = grams / 100;
  addFoodEntry({
    id: Date.now(),
    date: new Date().toISOString(),
    name: food.name,
    grams,
    kcal: Math.round(food.kcal * ratio),
    p: Math.round(food.p * ratio * 10) / 10,
    c: Math.round(food.c * ratio * 10) / 10,
    f: Math.round(food.f * ratio * 10) / 10
  });
  document.getElementById('foodGramsInput').value = 100;
});

document.getElementById('customFoodForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('customFoodName').value.trim();
  const grams = parseFloat(document.getElementById('customFoodGrams').value) || 100;
  const kcal = parseFloat(document.getElementById('customFoodKcal').value) || 0;
  const p = parseFloat(document.getElementById('customFoodProtein').value) || 0;
  const c = parseFloat(document.getElementById('customFoodCarbs').value) || 0;
  const f = parseFloat(document.getElementById('customFoodFat').value) || 0;
  if (!name) { alert('Ponle un nombre al alimento antes de añadirlo.'); return; }
  if (!kcal) { alert('Faltan las kcal totales — sin eso no se puede añadir. Si no las sabes exactas, pon una estimación (mira el envase o busca "kcal [nombre del alimento]").'); return; }
  addFoodEntry({ id: Date.now(), date: new Date().toISOString(), name, grams, kcal, p, c, f });
  e.target.reset();
  document.getElementById('customFoodGrams').value = 100;
  document.getElementById('customFoodForm').classList.add('hidden');
});

function addFoodEntry(entry) {
  if (!state.foodLog) state.foodLog = [];
  state.foodLog.push(entry);
  save(STORAGE_KEYS.foodLog, state.foodLog);
  renderFoodLog();
}
function deleteFoodEntry(id) {
  state.foodLog = state.foodLog.filter(e => e.id !== id);
  save(STORAGE_KEYS.foodLog, state.foodLog);
  renderFoodLog();
}
function renderFoodLog() {
  const todayEntries = (state.foodLog || []).filter(e => e.date.slice(0, 10) === todayKey());
  const foodListEl = document.getElementById('foodList');
  document.getElementById('foodEmpty').style.display = todayEntries.length ? 'none' : 'block';

  foodListEl.innerHTML = [...todayEntries].reverse().map(e => `
    <li>
      <span>${e.name} (${e.grams}g)</span>
      <span class="val">${e.kcal} kcal</span>
      <button class="del" onclick="deleteFoodEntry(${e.id})">✕</button>
    </li>
  `).join('');

  const totals = todayEntries.reduce((acc, e) => ({
    kcal: acc.kcal + e.kcal, p: acc.p + e.p, c: acc.c + e.c, f: acc.f + e.f
  }), { kcal: 0, p: 0, c: 0, f: 0 });

  document.getElementById('totalKcal').textContent = Math.round(totals.kcal);
  document.getElementById('totalProtein').textContent = Math.round(totals.p) + 'g';
  document.getElementById('totalCarbs').textContent = Math.round(totals.c) + 'g';
  document.getElementById('totalFat').textContent = Math.round(totals.f) + 'g';

  if (typeof renderGraficos === 'function' && state.goals) renderGraficos();
}

/* ---------- LISTA DE COMPRA ---------- */
const itemForm = document.getElementById('itemForm');
const shoppingListEl = document.getElementById('shoppingList');
const shoppingEmpty = document.getElementById('shoppingEmpty');

// Precio aproximado por 100g (o por unidad) y súper habitual. Son
// precios orientativos (no leemos webs de súpers en tiempo real, ver
// README) — sirven para hacerte una idea del gasto, no son exactos.
const PRECIO_DB = [
  { keys: ['pollo'], label: 'Pollo', eur100g: 0.9, store: 'Mercadona' },
  { keys: ['arroz'], label: 'Arroz', eur100g: 0.15, store: 'Mercadona' },
  { keys: ['calabacin', 'calabacín'], label: 'Calabacín', eur100g: 0.2, store: 'Mercadona' },
  { keys: ['pimiento'], label: 'Pimiento', eur100g: 0.3, store: 'Mercadona' },
  { keys: ['cebolla'], label: 'Cebolla', eur100g: 0.15, store: 'Mercadona' },
  { keys: ['huevo'], label: 'Huevos', eurUd: 0.25, store: 'Mercadona' },
  { keys: ['champin', 'champiñ'], label: 'Champiñones', eur100g: 0.45, store: 'Mercadona' },
  { keys: ['ensalada', 'lechuga'], label: 'Ensalada/lechuga', eur100g: 0.3, store: 'Mercadona' },
  { keys: ['chili'], label: 'Chili (ingredientes)', eur100g: 0.6, store: 'Mercadona' },
  { keys: ['albondiga', 'albóndiga'], label: 'Albóndigas', eurUd: 0.35, store: 'Mercadona' },
  { keys: ['ñoqui', 'noqui'], label: 'Ñoquis', eur100g: 0.5, store: 'Lidl' },
  { keys: ['pisto'], label: 'Pisto (ingredientes)', eur100g: 0.4, store: 'Mercadona' },
  { keys: ['hamburguesa'], label: 'Hamburguesa casera', eurUd: 1.2, store: 'Mercadona' },
  { keys: ['lasaña', 'lasagna', 'lasana'], label: 'Lasaña', eur100g: 0.9, store: 'Lidl' },
  { keys: ['salchicha'], label: 'Salchichas', eur100g: 0.7, store: 'Lidl' },
  { keys: ['gulas'], label: 'Gulas', eur100g: 1.6, store: 'Mercadona' },
  { keys: ['berenjena'], label: 'Berenjena', eur100g: 0.35, store: 'Mercadona' },
  { keys: ['crema'], label: 'Base para crema de verduras', eur100g: 0.35, store: 'Mercadona' },
  { keys: ['salmon', 'salmón'], label: 'Salmón', eur100g: 1.8, store: 'Mercadona' },
  { keys: ['lenteja'], label: 'Lentejas', eur100g: 0.25, store: 'Mercadona' },
  { keys: ['garbanzo'], label: 'Garbanzos', eur100g: 0.25, store: 'Mercadona' },
  { keys: ['atun', 'atún'], label: 'Atún en lata', eur100g: 1.25, store: 'Mercadona' },
  { keys: ['queso'], label: 'Queso fresco', eur100g: 0.8, store: 'Mercadona' },
  { keys: ['nuez', 'nueces'], label: 'Nueces', eur100g: 1.5, store: 'Carrefour Express' },
  { keys: ['tomate'], label: 'Tomate', eur100g: 0.25, store: 'Mercadona' },
  { keys: ['merluza'], label: 'Merluza', eur100g: 1.4, store: 'Mercadona' },
  { keys: ['pescado blanco'], label: 'Pescado blanco', eur100g: 1.2, store: 'Mercadona' },
  { keys: ['quinoa'], label: 'Quinoa', eur100g: 0.7, store: 'Carrefour Express' },
  { keys: ['espinaca'], label: 'Espinacas', eur100g: 0.3, store: 'Mercadona' },
  { keys: ['brocoli', 'brócoli'], label: 'Brócoli', eur100g: 0.3, store: 'Mercadona' },
  { keys: ['platano', 'plátano'], label: 'Plátano', eur100g: 0.18, store: 'Mercadona' },
  { keys: ['boniato', 'batata'], label: 'Boniato', eur100g: 0.2, store: 'Mercadona' }
];

function matchAllPrices(texto) {
  const norm = normalizeText(texto);
  return PRECIO_DB.filter(item => item.keys.some(k => norm.includes(normalizeText(k))));
}

// Suma los ingredientes de las 7 comidas y cenas de la pestaña Menús,
// reparte a partes iguales cuando una línea mezcla varios alimentos
// reconocidos (p.ej. "pimiento y cebolla"), y genera un producto por
// alimento con cantidad total, súper y precio estimado.
function generateShoppingListFromMenu() {
  const totals = {}; // key del alimento -> { grams, uds, price }
  const sinReconocer = new Set();

  getMenuPlanState().forEach(d => {
    ['comida', 'cena'].forEach(mealKey => {
      (d[mealKey] || []).forEach(ing => {
        if (!ing.texto || !ing.cantidad) return;
        const grams = parseCantidadGrams(ing.cantidad, null) || 0;
        const udsMatch = ing.cantidad.match(/^([\d.,]+)\s*(uds?|unidades?)\b/i);
        const uds = udsMatch ? parseFloat(udsMatch[1].replace(',', '.')) : 0;

        const hits = matchAllPrices(ing.texto);
        if (!hits.length) { sinReconocer.add(ing.texto); return; }

        const share = 1 / hits.length;
        hits.forEach(hit => {
          const key = hit.keys[0];
          if (!totals[key]) totals[key] = { grams: 0, uds: 0, price: hit };
          totals[key].grams += grams * share;
          totals[key].uds += uds * share;
        });
      });
    });
  });

  // Quita los productos generados en una tanda anterior, pero conserva
  // los que hayas añadido tú a mano.
  state.shopping = state.shopping.filter(i => !i.fromMenu);

  let totalEstimado = 0;
  Object.values(totals).forEach(({ grams, uds, price }) => {
    let qtyLabel, importe = null;
    if (grams > 0) {
      qtyLabel = `${Math.round(grams)} g`;
      if (price.eur100g) importe = price.eur100g * (grams / 100);
    } else if (uds > 0) {
      qtyLabel = `${Math.round(uds)} uds`;
      if (price.eurUd) importe = price.eurUd * uds;
    } else {
      qtyLabel = '';
    }
    if (importe != null) totalEstimado += importe;
    const note = [qtyLabel, importe != null ? `≈${importe.toFixed(2)}€` : 'precio no estimado']
      .filter(Boolean).join(' · ');
    state.shopping.push({
      id: Date.now() + Math.random(),
      name: price.label,
      store: price.store,
      note,
      done: false,
      fromMenu: true
    });
  });

  sinReconocer.forEach(texto => {
    state.shopping.push({
      id: Date.now() + Math.random(),
      name: texto,
      store: 'Mercadona',
      note: 'revisa cantidad y precio a mano',
      done: false,
      fromMenu: true
    });
  });

  save(STORAGE_KEYS.shopping, state.shopping);
  renderShopping();

  const statusEl = document.getElementById('generateShoppingStatus');
  statusEl.textContent = `Lista generada — total estimado ≈${totalEstimado.toFixed(2)}€ (no cuenta lo que no se pudo calcular). Revisa cantidades y súper antes de ir a comprar.`;
}

document.getElementById('generateShoppingBtn').addEventListener('click', generateShoppingListFromMenu);

itemForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('itemName').value.trim();
  const store = document.getElementById('itemStore').value;
  const note = document.getElementById('itemNote').value.trim();
  if (!name) return;
  state.shopping.push({ id: Date.now(), name, store, note, done: false });
  save(STORAGE_KEYS.shopping, state.shopping);
  itemForm.reset();
  renderShopping();
});

function toggleItem(id) {
  const item = state.shopping.find(i => i.id === id);
  if (item) item.done = !item.done;
  save(STORAGE_KEYS.shopping, state.shopping);
  renderShopping();
}

function deleteItem(id) {
  state.shopping = state.shopping.filter(i => i.id !== id);
  save(STORAGE_KEYS.shopping, state.shopping);
  renderShopping();
}

function renderShopping() {
  shoppingEmpty.style.display = state.shopping.length ? 'none' : 'block';

  // Agrupado por súper, para poder ir tienda por tienda.
  const stores = ['Mercadona', 'Lidl', 'Carrefour Express'];
  const byStore = stores.map(store => ({
    store,
    items: state.shopping.filter(i => (i.store || 'Mercadona') === store)
  })).filter(g => g.items.length);

  shoppingListEl.innerHTML = byStore.map(group => `
    <li class="shopping-store-header">${group.store}</li>
    ${group.items.map(item => `
      <li class="${item.done ? 'done' : ''}">
        <button class="checkbox ${item.done ? 'checked' : ''}" onclick="toggleItem(${item.id})"></button>
        <div class="item-main">
          <div class="item-name">${item.name}</div>
          <div class="item-meta">${item.note || ''}</div>
        </div>
        <button class="del" onclick="deleteItem(${item.id})">✕</button>
      </li>
    `).join('')}
  `).join('');
}

/* ---------- GRÁFICOS ----------
   Todo esto se calcula a partir de datos que ya se guardan solos al
   usar la app: el histórico de mediciones (Nutrición), el histórico
   de entrenos (Entrenos) y el diario de comidas (Compra). No hace
   falta ningún registro nuevo — es una forma de ver esos mismos datos
   a lo largo del tiempo.
------------------------------------------------------------------- */
state.goals = load(STORAGE_KEYS.goals, { fat: 28, muscle: 36.5, date: '2026-12-01' });

const goalForm = document.getElementById('goalForm');
document.getElementById('goalFatInput').value = state.goals.fat;
document.getElementById('goalMuscleInput').value = state.goals.muscle;
document.getElementById('goalDateInput').value = state.goals.date;

goalForm.addEventListener('submit', (e) => {
  e.preventDefault();
  state.goals = {
    fat: parseFloat(document.getElementById('goalFatInput').value) || state.goals.fat,
    muscle: parseFloat(document.getElementById('goalMuscleInput').value) || state.goals.muscle,
    date: document.getElementById('goalDateInput').value || state.goals.date
  };
  save(STORAGE_KEYS.goals, state.goals);
  renderGoalStatus();
  renderFatChart();
  renderMuscleChart();
});

function lastWeightWith(field) {
  const withField = state.weights.filter(w => w[field] != null);
  return withField.length ? withField[withField.length - 1] : null;
}

function renderGoalStatus() {
  const statusEl = document.getElementById('goalStatus');
  const lastFat = lastWeightWith('fat');
  const lastMuscle = lastWeightWith('muscle');
  const daysLeft = Math.ceil((new Date(state.goals.date) - new Date()) / 86400000);

  const fatRow = lastFat
    ? `<div class="goal-row"><span class="goal-label">Grasa actual → objetivo ${state.goals.fat}%</span>
        <span class="goal-value ${lastFat.fat <= state.goals.fat ? 'ok' : 'pending'}">${lastFat.fat}% ${lastFat.fat <= state.goals.fat ? '✓' : `(faltan ${(lastFat.fat - state.goals.fat).toFixed(1)} pts)`}</span></div>`
    : `<div class="goal-row"><span class="goal-label">Grasa</span><span class="goal-value">sin mediciones</span></div>`;

  const muscleRow = lastMuscle
    ? `<div class="goal-row"><span class="goal-label">Músculo actual → objetivo ${state.goals.muscle} kg</span>
        <span class="goal-value ${lastMuscle.muscle >= state.goals.muscle ? 'ok' : 'pending'}">${lastMuscle.muscle} ${lastMuscle.muscle >= state.goals.muscle ? '✓' : `(faltan ${(state.goals.muscle - lastMuscle.muscle).toFixed(1)} kg)`}</span></div>`
    : `<div class="goal-row"><span class="goal-label">Músculo</span><span class="goal-value">sin mediciones</span></div>`;

  const daysMsg = daysLeft > 0 ? `${daysLeft} días hasta el objetivo` : 'Fecha objetivo ya pasada';
  statusEl.innerHTML = fatRow + muscleRow + `<div class="goal-days-left">⏳ ${daysMsg}</div>`;
}

function renderFatChart() {
  const withFat = state.weights.filter(w => w.fat != null);
  const ctx = document.getElementById('fatChart');
  document.getElementById('graficosWeightEmpty').style.display = state.weights.length ? 'none' : 'block';
  if (fatChartInstance) fatChartInstance.destroy();
  fatChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: withFat.map(w => new Date(w.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })),
      datasets: [
        { label: 'Grasa %', data: withFat.map(w => w.fat), borderColor: '#FF6B4A', backgroundColor: 'rgba(255,107,74,0.12)', tension: 0.3, fill: true, pointRadius: 3 },
        { label: 'Objetivo', data: withFat.map(() => state.goals.fat), borderColor: '#8A9298', borderDash: [6, 4], pointRadius: 0, fill: false }
      ]
    },
    options: {
      plugins: { legend: { display: true, labels: { color: '#8A9298', font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: '#8A9298', font: { size: 10 } }, grid: { color: '#2A3338' } },
        y: { ticks: { color: '#8A9298', font: { size: 10 } }, grid: { color: '#2A3338' } }
      }
    }
  });
}

function renderMuscleChart() {
  const withMuscle = state.weights.filter(w => w.muscle != null);
  const ctx = document.getElementById('muscleChart');
  if (muscleChartInstance) muscleChartInstance.destroy();
  muscleChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: withMuscle.map(w => new Date(w.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })),
      datasets: [
        { label: 'Músculo', data: withMuscle.map(w => w.muscle), borderColor: '#C6F135', backgroundColor: 'rgba(198,241,53,0.12)', tension: 0.3, fill: true, pointRadius: 3 },
        { label: 'Objetivo', data: withMuscle.map(() => state.goals.muscle), borderColor: '#8A9298', borderDash: [6, 4], pointRadius: 0, fill: false }
      ]
    },
    options: {
      plugins: { legend: { display: true, labels: { color: '#8A9298', font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: '#8A9298', font: { size: 10 } }, grid: { color: '#2A3338' } },
        y: { ticks: { color: '#8A9298', font: { size: 10 } }, grid: { color: '#2A3338' } }
      }
    }
  });
}

// Agrupa entrenos por semana (lunes de esa semana como clave), en todo
// el histórico — no solo la semana actual como el gráfico de Entrenos.
function aggregateWorkoutsByWeek() {
  const map = {};
  state.workouts.forEach(w => {
    const key = startOfWeek(new Date(w.date)).toISOString().slice(0, 10);
    if (!map[key]) map[key] = { kcal: 0, sessions: 0 };
    map[key].kcal += w.calories;
    map[key].sessions += 1;
  });
  const weeks = Object.keys(map).sort();
  return {
    labels: weeks.map(k => new Date(k).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })),
    kcal: weeks.map(k => map[k].kcal),
    sessions: weeks.map(k => map[k].sessions)
  };
}

function renderWorkoutHistoryCharts() {
  const { labels, kcal, sessions } = aggregateWorkoutsByWeek();
  document.getElementById('graficosWorkoutEmpty').style.display = state.workouts.length ? 'none' : 'block';

  const ctx1 = document.getElementById('workoutHistoryChart');
  if (workoutHistoryChartInstance) workoutHistoryChartInstance.destroy();
  workoutHistoryChartInstance = new Chart(ctx1, {
    type: 'bar',
    data: { labels, datasets: [{ data: kcal, backgroundColor: '#FF6B4A', borderRadius: 4 }] },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8A9298', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#8A9298', font: { size: 10 } }, grid: { color: '#2A3338' } }
      }
    }
  });

  const ctx2 = document.getElementById('sessionsHistoryChart');
  if (sessionsHistoryChartInstance) sessionsHistoryChartInstance.destroy();
  sessionsHistoryChartInstance = new Chart(ctx2, {
    type: 'bar',
    data: { labels, datasets: [{ data: sessions, backgroundColor: '#C6F135', borderRadius: 4 }] },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8A9298', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#8A9298', font: { size: 10 }, stepSize: 1 }, grid: { color: '#2A3338' } }
      }
    }
  });
}

// Agrupa el diario de comidas por día (todo el histórico), y se queda
// con los últimos N días que tengan algo anotado.
function aggregateFoodLogByDay(maxDays = 30) {
  const map = {};
  (state.foodLog || []).forEach(e => {
    const key = e.date.slice(0, 10);
    if (!map[key]) map[key] = { kcal: 0, p: 0 };
    map[key].kcal += e.kcal;
    map[key].p += e.p;
  });
  const days = Object.keys(map).sort().slice(-maxDays);
  return {
    labels: days.map(k => new Date(k).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })),
    kcal: days.map(k => Math.round(map[k].kcal)),
    protein: days.map(k => Math.round(map[k].p))
  };
}

function renderFoodHistoryCharts() {
  const { labels, kcal, protein } = aggregateFoodLogByDay();
  document.getElementById('graficosFoodEmpty').style.display = (state.foodLog || []).length ? 'none' : 'block';

  const ctx1 = document.getElementById('calorieIntakeChart');
  if (calorieIntakeChartInstance) calorieIntakeChartInstance.destroy();
  calorieIntakeChartInstance = new Chart(ctx1, {
    type: 'bar',
    data: { labels, datasets: [{ data: kcal, backgroundColor: '#FF6B4A', borderRadius: 4 }] },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8A9298', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#8A9298', font: { size: 10 } }, grid: { color: '#2A3338' } }
      }
    }
  });

  const ctx2 = document.getElementById('proteinIntakeChart');
  if (proteinIntakeChartInstance) proteinIntakeChartInstance.destroy();
  proteinIntakeChartInstance = new Chart(ctx2, {
    type: 'line',
    data: { labels, datasets: [{ data: protein, borderColor: '#C6F135', backgroundColor: 'rgba(198,241,53,0.12)', tension: 0.3, fill: true, pointRadius: 3 }] },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8A9298', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#8A9298', font: { size: 10 } }, grid: { color: '#2A3338' } }
      }
    }
  });
}

// Junta, por día, lo consumido (diario de comidas) y lo gastado (tu
// metabolismo basal repartido ese día + las kcal de los entrenos que
// hicieras ese día). El metabolismo se calcula igual que en Entrenos
// (báscula real > grasa% > altura), con tu peso más reciente.
function aggregateBalanceByDay(maxDays = 30) {
  const map = {};
  (state.foodLog || []).forEach(e => {
    const key = e.date.slice(0, 10);
    if (!map[key]) map[key] = { consumed: 0, burned: 0 };
    map[key].consumed += e.kcal;
  });
  state.workouts.forEach(w => {
    const key = w.date.slice(0, 10);
    if (!map[key]) map[key] = { consumed: 0, burned: 0 };
    map[key].burned += w.calories;
  });
  const bmr = estimateBMR(getLastWeight()) || 0;
  const days = Object.keys(map).sort().slice(-maxDays);
  return {
    labels: days.map(k => new Date(k).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })),
    consumed: days.map(k => Math.round(map[k].consumed)),
    burned: days.map(k => Math.round(map[k].burned + bmr))
  };
}

function renderBalanceChart() {
  const { labels, consumed, burned } = aggregateBalanceByDay();
  document.getElementById('graficosBalanceEmpty').style.display = labels.length ? 'none' : 'block';
  const ctx = document.getElementById('balanceChart');
  if (balanceChartInstance) balanceChartInstance.destroy();
  balanceChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Consumidas', data: consumed, backgroundColor: '#FF6B4A', borderRadius: 4 },
        { label: 'Gastadas', data: burned, backgroundColor: '#C6F135', borderRadius: 4 }
      ]
    },
    options: {
      plugins: { legend: { display: true, labels: { color: '#8A9298', font: { size: 10 } } } },
      scales: {
        x: { ticks: { color: '#8A9298', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#8A9298', font: { size: 10 } }, grid: { color: '#2A3338' } }
      }
    }
  });
}

let fatChartInstance, muscleChartInstance, workoutHistoryChartInstance, sessionsHistoryChartInstance, calorieIntakeChartInstance, proteinIntakeChartInstance, balanceChartInstance;

function renderGraficos() {
  renderGoalStatus();
  renderFatChart();
  renderMuscleChart();
  renderWorkoutHistoryCharts();
  renderFoodHistoryCharts();
  renderBalanceChart();
}

/* ---------- INICIO ---------- */
renderPhotos();
renderWeights();
renderWorkouts();
renderShopping();
renderPlan();
renderMobility();
renderMenuPlan();
renderMenuHistory();
renderFoodLog();
renderGraficos();
showRandomTip();
setupFolderConnector('peso', 'connectWeightFolderBtn', 'scanWeightFolderBtn', 'weightFolderStatus');
setupFolderConnector('entreno', 'connectWorkoutFolderBtn', 'scanWorkoutFolderBtn', 'workoutFolderStatus');
