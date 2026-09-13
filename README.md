# Cuaderno de entreno — Puente de Vallecas

App web sencilla (HTML + CSS + JS, sin frameworks ni instalación) para llevar:

- 📸 Fotos de progreso (botón "+" arriba) + captura opcional en cada registro de peso/entreno
- 📁 **Importar desde carpetas del móvil** (solo Android + Chrome): conecta la carpeta donde guardas las fotos de la báscula y la del entreno, y la app las detecta e intenta leer los números por ti (OCR)
- 🥗 **Nutrición**: peso y composición corporal completa (grasa, músculo, agua, grasa visceral, masa ósea), IMC automático, gráfico de evolución y tips
- 🏋️ **Entrenos**: plan semanal reducido (glúteo 3x/semana con sábado incluido, movilidad de sentadilla 3x/semana, movilidad de cadera todos los días), registro de entrenos con ejercicios y kilos, cálculo automático de calorías según tu peso
- 🛒 **Compra**: menú semanal sugerido (comida en tupper único, cena ligera con pescado), diario de comidas con calorías y macros, lista de la compra por súper

Todos los datos se guardan en tu propio navegador (`localStorage`). No hay servidor,
así que si cambias de navegador o de móvil, no se sincroniza — es una limitación
consciente para mantenerlo simple mientras aprendes.

## 📁 Conectar una carpeta de fotos del móvil (Android + Chrome)

En la pestaña **Nutrición** (bajo el formulario de peso) y en **Entrenos** (bajo
el formulario de entreno) hay una tarjeta "Carpeta de fotos". Ahí puedes:

1. Pulsar **"Conectar carpeta"** y elegir la carpeta del móvil donde guardas
   ese tipo de foto (por ejemplo, una carpeta "Báscula" y otra "Entreno" —
   la app recuerda cada una por separado). El navegador te pedirá permiso.
2. Pulsar **"Buscar fotos nuevas"** cuando quieras. La app compara con lo que
   ya has importado y solo te enseña las fotos que aún no ha visto.
3. Para cada foto nueva, intenta **leer el número automáticamente** (peso,
   % de grasa/músculo/agua, minutos, kcal...) con una tecnología de lectura
   de texto en imágenes llamada OCR (la librería Tesseract.js, gratis y sin
   clave de API). El resultado se rellena en un formulario, pero **siempre
   tienes que revisarlo y corregirlo si hace falta** antes de pulsar
   "Guardar" — la lectura automática falla a veces, sobre todo con letras
   pequeñas, reflejos o fotos borrosas.

### Por qué esto no funciona igual en todos los móviles

- **Android + Chrome**: es el único caso en el que un navegador puede
  "conectar" con una carpeta real del sistema de archivos (una función del
  navegador llamada *File System Access API*). Por eso esta función solo
  aparece activa ahí.
- **iPhone (Safari)**: Safari no tiene esa función. Ahí sigue funcionando el
  botón normal de "adjuntar foto" de cada formulario (subes la foto a mano,
  como siempre).
- Todo el procesamiento (compresión de la foto y OCR) ocurre **en tu propio
  navegador**: ninguna foto se sube a ningún servidor. Eso sí, la primera vez
  necesitas conexión a internet para que el navegador descargue la librería
  de lectura de texto (Tesseract.js) desde su CDN.

## ⚠️ Sobre las "ofertas" de los súpers

La app **no** puede leer en tiempo real las ofertas de Mercadona, Lidl o
Carrefour Express (eso requeriría conectarse a sus webs, que no lo permiten).
La pestaña de compra te deja anotar manualmente el precio u oferta de cada
producto. Si quieres, pídeme en el chat de Claude "búscame las ofertas de
esta semana en [súper]" y las copias aquí a mano.

## Cómo probarla en tu ordenador

No necesitas instalar nada. Basta con abrir `index.html` con el navegador,
o mejor, levantar un servidor local para evitar restricciones del navegador
con `localStorage`:

```bash
# Con Python (casi seguro ya lo tienes instalado)
cd cuaderno-vallecas
python3 -m http.server 8000
```

Luego abre `http://localhost:8000` en el navegador.

## Cómo subirla a GitHub

```bash
cd cuaderno-vallecas
git init
git add .
git commit -m "Primera versión del cuaderno de entreno"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/cuaderno-vallecas.git
git push -u origin main
```

(Cambia `TU_USUARIO` por tu usuario de GitHub, y crea antes el repo vacío en
github.com — botón "New repository", sin marcar ningún archivo inicial.)

## Publicarla gratis con GitHub Pages

1. En tu repo de GitHub, ve a **Settings → Pages**.
2. En "Branch" selecciona `main` y la carpeta `/ (root)`.
3. Guarda. En un minuto tendrás tu app en una URL tipo
   `https://TU_USUARIO.github.io/cuaderno-vallecas/`, accesible desde el móvil.

## Instalarla en el móvil (como una app de verdad)

La app es una **PWA** (Progressive Web App): no está en Google Play ni en la
App Store, pero se instala igual, con icono propio y a pantalla completa.

**Android (Chrome):**
1. Abre la URL de GitHub Pages en Chrome.
2. Te saldrá un aviso "Añadir Cuaderno a la pantalla de inicio" (o desde el
   menú ⋮ → "Instalar aplicación").
3. Acepta. Te aparece el icono en el cajón de apps, como cualquier otra.

**iPhone (Safari):**
1. Abre la URL en Safari (tiene que ser Safari, no Chrome).
2. Toca el icono de compartir (el cuadrado con la flecha hacia arriba).
3. Baja hasta "Añadir a pantalla de inicio".
4. Acepta. Te queda como icono en tu pantalla, se abre sin barra de navegador.

Una vez instalada funciona offline (gracias al `sw.js`), aunque recuerda que
los datos siguen viviendo solo en ese navegador/dispositivo — si desinstalas
la app o borras datos del navegador, se pierden.

## Estructura del proyecto

```
cuaderno-vallecas/
├── index.html      → estructura de la app (las 3 pestañas)
├── styles.css      → todo el diseño visual
├── app.js          → toda la lógica (guardar peso, entrenos, lista, fotos)
├── manifest.json   → hace que la app sea instalable en el móvil
├── sw.js           → service worker: cachea la app para que funcione offline
├── icons/          → iconos de la app (192px y 512px)
└── README.md       → este archivo
```

## Ideas para seguir aprendiendo sobre esta app

- Añadir un campo de "objetivo de peso" y mostrar cuánto falta.
- Exportar el historial a CSV para abrirlo en Excel/Sheets.
- Sustituir `localStorage` por una base de datos real (ej. Supabase) si algún
  día quieres acceder desde varios dispositivos.
- Convertirla en PWA (app instalable) añadiendo un `manifest.json`.
