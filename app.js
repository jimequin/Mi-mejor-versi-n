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
  foodLog: 'cuaderno.foodLog'
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
  foodLog: load(STORAGE_KEYS.foodLog, [])
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
  const entry = {
    id: Date.now(),
    date: new Date().toISOString(),
    kg: value,
    fat: parseFloat(document.getElementById('fatInput').value) || null,
    muscle: parseFloat(document.getElementById('muscleInput').value) || null,
    water: parseFloat(document.getElementById('waterInput').value) || null,
    visceral: parseFloat(document.getElementById('visceralInput').value) || null,
    bone: parseFloat(document.getElementById('boneInput').value) || null,
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
      w.muscle != null ? `Músculo ${w.muscle}%` : '',
      w.water != null ? `Agua ${w.water}%` : '',
      w.visceral != null ? `Visceral ${w.visceral}` : '',
      w.bone != null ? `Ósea ${w.bone}kg` : ''
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
}

/* ---------- PLAN SEMANAL ---------- */
const WEEKLY_PLAN = [
  { key: 'lun', label: 'Lunes', types: ['gluteo'] },
  { key: 'mar', label: 'Martes', types: ['squat'] },
  { key: 'mie', label: 'Miércoles', types: ['gluteo'] },
  { key: 'jue', label: 'Jueves', types: ['squat'] },
  { key: 'vie', label: 'Viernes', types: [] },
  { key: 'sab', label: 'Sábado', types: ['gluteo', 'squat'] },
  { key: 'dom', label: 'Domingo', types: [] }
];

const PLAN_EXERCISES = {
  gluteo: {
    title: '💪 Glúteo · 3-4 series, descanso 45-60s',
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
    const items = plan.items.map((text, idx) => `
      <li class="${checked.includes(idx) ? 'plan-checked' : ''}">
        <button class="plan-check ${checked.includes(idx) ? 'checked' : ''}" onclick="toggleCheck('${listKey}', ${idx})"></button>
        <span class="plan-text">${text}</span>
      </li>
    `).join('');
    return `<p class="plan-block-title">${plan.title}</p><ul class="plan-list">${items}</ul>`;
  }).join('');
}

function selectPlanDay(idx) {
  selectedPlanDay = idx;
  renderPlan();
}

function renderMobility() {
  renderCheckList(document.getElementById('mobilityHipList'), MOBILITY_HIP, 'mobility-hip-' + todayKey());
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

function estimateCalories() {
  const select = document.getElementById('sportInput');
  const met = parseFloat(select.selectedOptions[0]?.dataset.met) || 6;
  const minutes = parseInt(document.getElementById('minutesInput').value, 10);
  if (!minutes) {
    calorieHint.textContent = 'Pon los minutos para poder calcular.';
    return null;
  }
  const kg = getLastWeight();
  // Fórmula estándar: kcal = MET x peso(kg) x horas
  const kcal = Math.round(met * kg * (minutes / 60));
  calorieHint.textContent = `Estimado con tu último peso registrado (${kg} kg).`;
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
}

/* ---------- MENÚ SEMANAL SUGERIDO ---------- */
const MENU_PLAN = [
  { day: 'Lunes', comida: 'Arroz integral con pollo a la plancha, calabacín y pimiento salteado', cena: 'Crema de calabacín con huevo duro' },
  { day: 'Martes', comida: 'Lentejas estofadas con verduras y taquitos de pavo', cena: 'Merluza al horno con espárragos' },
  { day: 'Miércoles', comida: 'Pasta integral con atún, tomate y aceitunas', cena: 'Tortilla francesa con champiñones y ensalada' },
  { day: 'Jueves', comida: 'Quinoa con garbanzos, espinacas y huevo', cena: 'Salmón al vapor con brócoli' },
  { day: 'Viernes', comida: 'Arroz con verduras y gambas', cena: 'Revuelto de espárragos con jamón de pavo' },
  { day: 'Sábado', comida: 'Pollo al curry con arroz basmati y verduras', cena: 'Ensalada de queso fresco, tomate y nueces' },
  { day: 'Domingo', comida: 'Garbanzos con verdura (puchero de toda la vida)', cena: 'Pescado blanco a la plancha con ensalada' }
];

function renderMenuPlan() {
  document.getElementById('menuPlan').innerHTML = MENU_PLAN.map(d => `
    <div class="menu-day">
      <div class="menu-day-title">${d.day}</div>
      <div class="menu-day-line"><b>COMIDA</b> ${d.comida}</div>
      <div class="menu-day-line cena"><b>CENA</b> ${d.cena}</div>
    </div>
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
  if (!name || !kcal) return;
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
renderMenuPlan();
renderFoodLog();
showRandomTip();
