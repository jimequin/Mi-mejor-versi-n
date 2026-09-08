/* ==========================================================
   Cuaderno de entreno · Puente de Vallecas
   Guarda todo en localStorage del navegador (no hay servidor).
   ========================================================== */

const STORAGE_KEYS = {
  photos: 'cuaderno.photos',
  weights: 'cuaderno.weights',
  workouts: 'cuaderno.workouts',
  shopping: 'cuaderno.shopping',
  planChecks: 'cuaderno.planChecks'
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
  shopping: load(STORAGE_KEYS.shopping, [])
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
  state.weights.push({ id: Date.now(), date: new Date().toISOString(), kg: value, photo: pendingWeightPhoto });
  state.weights.sort((a, b) => new Date(a.date) - new Date(b.date));
  save(STORAGE_KEYS.weights, state.weights);
  weightInput.value = '';
  pendingWeightPhoto = null;
  weightPhotoInput.value = '';
  weightPhotoName.textContent = '';
  renderWeights();
});

function deleteWeight(id) {
  state.weights = state.weights.filter(w => w.id !== id);
  save(STORAGE_KEYS.weights, state.weights);
  renderWeights();
}

function renderWeights() {
  weightEmpty.style.display = state.weights.length ? 'none' : 'block';

  weightList.innerHTML = [...state.weights].reverse().map(w => `
    <li>
      ${w.photo ? `<img class="log-thumb" src="${w.photo}" onclick="openPhotoModal('${w.photo}')">` : ''}
      <span>${new Date(w.date).toLocaleDateString('es-ES')}</span>
      <span class="val">${w.kg} kg</span>
      <button class="del" onclick="deleteWeight(${w.id})">✕</button>
    </li>
  `).join('');

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
}

/* ---------- PLAN SEMANAL ---------- */
const WEEKLY_PLAN = [
  { key: 'lun', label: 'Lunes', type: 'fuerte' },
  { key: 'mar', label: 'Martes', type: 'ligero' },
  { key: 'mie', label: 'Miércoles', type: 'fuerte' },
  { key: 'jue', label: 'Jueves', type: 'ligero' },
  { key: 'vie', label: 'Viernes', type: 'fuerte' },
  { key: 'sab', label: 'Sábado', type: 'ligero' },
  { key: 'dom', label: 'Domingo', type: 'descanso' }
];

const PLAN_EXERCISES = {
  fuerte: {
    title: '💪 Glúteo fuerte · 3-4 series, descanso 45-60s',
    items: [
      'Búlgara sin peso, pie en la cama — 10-12 reps/pierna',
      'Sentadilla con goma sobre rodillas — 15-20 reps',
      'Puente de glúteo con goma en rodillas — 15-20 reps',
      'Patada de glúteo a 4 patas con goma en tobillos — 15 reps/pierna',
      'Peso muerto rumano con goma bajo los pies — 15 reps'
    ]
  },
  ligero: {
    title: '🔹 Activación ligera · 2 series',
    items: [
      'Almeja con goma — 15-20 reps/lado',
      'Puente isométrico (aguantar 20-30s) — 3 veces',
      'Monster walk con goma en tobillos — 10 pasos c/dirección'
    ]
  },
  descanso: {
    title: '😴 Descanso',
    items: []
  }
};

const MOBILITY_HIP = [
  'Círculos de cadera a 4 patas — 10/lado',
  'Estiramiento 90/90 — 1 min/lado',
  "World's greatest stretch — 5/lado",
  'Rana (frog stretch) — 1 min aguantando',
  'Balanceo de pierna adelante-atrás — 10/lado'
];

const MOBILITY_SQUAT = [
  'Sentadilla profunda aguantada — 30-60s x3',
  'Estiramiento de tobillo contra pared — 10/lado',
  'Rock back de rana — 10 reps',
  'Sentadilla con pausa abajo (3s) — 8 reps'
];

let planChecks = load(STORAGE_KEYS.planChecks, {});

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

function toggleCheck(listKey, itemIdx) {
  if (!planChecks[listKey]) planChecks[listKey] = [];
  const pos = planChecks[listKey].indexOf(itemIdx);
  if (pos === -1) planChecks[listKey].push(itemIdx);
  else planChecks[listKey].splice(pos, 1);
  save(STORAGE_KEYS.planChecks, planChecks);
  renderPlan();
  renderMobility();
}

function renderCheckList(container, items, listKey) {
  const checked = planChecks[listKey] || [];
  container.innerHTML = items.map((text, idx) => `
    <li class="${checked.includes(idx) ? 'plan-checked' : ''}">
      <button class="plan-check ${checked.includes(idx) ? 'checked' : ''}" onclick="toggleCheck('${listKey}', ${idx})"></button>
      <span class="plan-text">${text}</span>
    </li>
  `).join('');
}

function renderPlan() {
  const pillsEl = document.getElementById('weekPills');
  const dayLetters = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const todayIdx = (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);

  pillsEl.innerHTML = WEEKLY_PLAN.map((d, idx) => `
    <button class="week-pill type-${d.type} ${idx === selectedPlanDay ? 'selected' : ''}"
      onclick="selectPlanDay(${idx})">
      ${dayLetters[idx]}${idx === todayIdx ? ' •' : ''}
    </button>
  `).join('');

  const day = WEEKLY_PLAN[selectedPlanDay];
  const plan = PLAN_EXERCISES[day.type];
  document.getElementById('planDayLabel').textContent = `${day.label} — ${plan.title}`;

  const listEl = document.getElementById('planExerciseList');
  if (plan.items.length === 0) {
    listEl.innerHTML = '<p class="plan-rest-msg">Sin ejercicios de glúteo. Aprovecha para la movilidad si te apetece.</p>';
  } else {
    const listKey = 'day-' + dateKeyForDayIndex(selectedPlanDay);
    renderCheckList(listEl, plan.items, listKey);
  }
}

function selectPlanDay(idx) {
  selectedPlanDay = idx;
  renderPlan();
}

function renderMobility() {
  renderCheckList(document.getElementById('mobilityHipList'), MOBILITY_HIP, 'mobility-hip-' + todayKey());
  renderCheckList(document.getElementById('mobilitySquatList'), MOBILITY_SQUAT, 'mobility-squat-' + todayKey());
}

/* ---------- ENTRENOS (registro libre) ---------- */
const workoutForm = document.getElementById('workoutForm');
const workoutList = document.getElementById('workoutList');
const workoutPhotoInput = document.getElementById('workoutPhotoInput');
const workoutPhotoName = document.getElementById('workoutPhotoName');
let workoutChart;
let pendingWorkoutPhoto = null;

workoutPhotoInput.addEventListener('change', async () => {
  const file = workoutPhotoInput.files[0];
  if (!file) return;
  pendingWorkoutPhoto = await compressImage(file, 640, 0.7);
  workoutPhotoName.textContent = '✓ ' + file.name;
});

workoutForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const sport = document.getElementById('sportInput').value;
  const minutes = parseInt(document.getElementById('minutesInput').value, 10);
  const calories = parseInt(document.getElementById('caloriesInput').value, 10);
  if (!sport || !minutes || !calories) return;
  state.workouts.push({ id: Date.now(), date: new Date().toISOString(), sport, minutes, calories, photo: pendingWorkoutPhoto });
  save(STORAGE_KEYS.workouts, state.workouts);
  workoutForm.reset();
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
  workoutList.innerHTML = [...state.workouts].reverse().map(w => `
    <li>
      ${w.photo ? `<img class="log-thumb" src="${w.photo}" onclick="openPhotoModal('${w.photo}')">` : ''}
      <span>${new Date(w.date).toLocaleDateString('es-ES')} · ${w.sport}</span>
      <span class="val">${w.calories} kcal</span>
      <button class="del" onclick="deleteWorkout(${w.id})">✕</button>
    </li>
  `).join('');

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
}

/* ---------- LISTA DE COMPRA ---------- */
const itemForm = document.getElementById('itemForm');
const shoppingListEl = document.getElementById('shoppingList');
const shoppingEmpty = document.getElementById('shoppingEmpty');

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
  shoppingListEl.innerHTML = state.shopping.map(item => `
    <li class="${item.done ? 'done' : ''}">
      <button class="checkbox ${item.done ? 'checked' : ''}" onclick="toggleItem(${item.id})"></button>
      <div class="item-main">
        <div class="item-name">${item.name}</div>
        <div class="item-meta">${item.store}${item.note ? ' · ' + item.note : ''}</div>
      </div>
      <button class="del" onclick="deleteItem(${item.id})">✕</button>
    </li>
  `).join('');
}

/* ---------- INICIO ---------- */
renderPhotos();
renderWeights();
renderWorkouts();
renderShopping();
renderPlan();
renderMobility();
showRandomTip();
