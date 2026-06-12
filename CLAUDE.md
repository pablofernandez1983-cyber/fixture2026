# CLAUDE.md — Fixture Mundial 2026 (app)

## Qué es
App web de **un solo archivo** (`index.html`) para seguir el Mundial 2026 en **hora de Argentina**: fixture completo, tablas de grupos, cuadro de eliminatorias, simulador y una sección de Argentina. Se despliega en **GitHub Pages** (estática, sin backend).

- Sin build step ni dependencias instalables: todo vive en `index.html`. Editá ese archivo directamente.
- Únicas dependencias externas: fuentes de Google (Bebas Neue / Barlow / Barlow Condensed) por CDN. Todo lo demás es vanilla JS + CSS inline.
- Estética clonada del álbum del autor: navy `#010D1E`, dorado `#FFB800`, `--surface #041828`, `--surface2 #0A2640`, rojo `#E8192C`, verde `#00C94E`, azul `#00D4FF`, muted `#6088AA`, border `#1A3A5C`. Mobile-first, PWA-ish (`theme-color`, `apple-mobile-web-app-*`). El viewport **permite pinch-zoom** (no tocar: se sacó `maximum-scale` a propósito).

## Convenciones (importante)
- **Responder y escribir UI en español rioplatense.**
- Prioridad: **exactitud y trazabilidad**. Nada de inventar datos; si una fuente no es verificable, marcarlo como aproximación dentro de la app.
- `localStorage` siempre envuelto en try/catch con fallback en memoria (para que funcione en Pages y no rompa en previews). **No** usar nada que rompa si `localStorage` falla.
- Mantener todo en un solo archivo. No partir en módulos.
- Probar en navegador real. (En el armado original se testeó la lógica con Node y el render con jsdom; no es obligatorio, pero el motor es testeable de forma aislada.)

## Estructura de `index.html` (~670 líneas)
1. `<head>`: meta/viewport (zoom habilitado), fuentes, **todo el CSS** en un `<style>`.
2. `<body>`: header (marca + botón Actualizar), tabs (Hoy / Grupos / Fase Final / Argentina; "Hoy" es la default), contenedores de cada vista, `#championBanner`, toast, y 3 modales: `#modalBg` (detalle de partido), `#cfgBg` (ajustes de azar), `#infoBg` (¿Cómo funciona?).
3. `<script>`: `const DATA = {...}` embebido + toda la lógica.

### Datos (`DATA`, embebido)
- `DATA.groups`: `{A:[4 equipos], ... L:[...]}` (nombres en español; 48 equipos, repechajes ya resueltos).
- `DATA.groupMatches`: 72 objetos `{id:'G#', group, home, away, venue, kickoff}`. `kickoff` es **ISO UTC con 'Z'**.
- `DATA.koMatches`: 32 objetos `{id:'M##', no, round, home, away, venue, kickoff}`. `round` ∈ `R32,R16,QF,SF,3P,F`.
  - `home`/`away` son **slots** (no equipos): `{t:'W',g:'A'}` ganador grupo, `{t:'R',g:'B'}` segundo, `{t:'T',gs:['A','B',...]}` mejor tercero elegible, `{t:'M',m:73}` ganador del partido 73, `{t:'ML',m:101}` perdedor (para 3er puesto).
- **Horarios**: se guardan en UTC (= ET+4, porque ET es EDT/UTC-4 en jun/jul) y se renderizan con `Intl.DateTimeFormat(..., {timeZone:'America/Argentina/Buenos_Aires'})`. ART = ET+1.

### Estado (`STATE`, persistido en `localStorage` key `fixture2026_v2`)
- `STATE.results[id] = {h,a}` marcador (string vacío permitido). Sirve para grupos (`G#`) y eliminatorias (`M##`).
- `STATE.adv[id] = 'home'|'away'` quién avanza en KO empatado (fallback si no hay penales cargados).
- `STATE.pens[id] = {h,a}` marcador de penales (si el KO terminó empatado).
- `STATE.sim = {det, K, wHist, base, champ}` config del simulador (ver abajo). `getSim()` rellena defaults.

## Lógica clave (nombres reales de funciones)
- **Fuerza**: `POW(team) = wHist*HIST[team] + (1-wHist)*ACT[team]`. `HIST` y `ACT` son dicts hardcodeados (ver Fuentes).
- **Simulación de partido**: `simMatch(home,away)` → modelo de goles **Poisson** (`pois`) con `lambda` ajustada por diferencia de fuerza (`K` = sensibilidad) y un pequeño plus de localía fijo (`HA=0.12`) para anfitriones (México/EE.UU./Canadá). En modo determinístico (`det`) no hay azar: gana el más fuerte con marcador según la brecha.
- **Penales**: `genPens()` genera un marcador realista (ganador > perdedor). En KO empatado, la simulación setea `adv` + `pens`. `penOf(no,side)` lee el penal para mostrar entre paréntesis.
- **Tablas**: `computeGroup(g)` (desempates: pts, dif. gol, GF, **fuerza POW**, alfabético), `allGroups()`, `thirdAssignment(G)` (rankea los 12 terceros, toma 8, los asigna a los 8 slots de tercero por **backtracking respetando elegibilidad** — aproxima la tabla oficial FIFA).
- **Resolución de llaves**: `resolveSlot(slot, matchNo)` resuelve W/R/T/M/ML a un equipo (los `T` usan `_T.assign[matchNo]`). `koWinnerLoser(no)` decide ganador (marcador → penales → adv). `resolveKoTeam(m,side)` = `{team,label}`. `recompute()` recalcula `_G` (grupos) y `_T` (terceros) y debe llamarse antes de re-render.
- **Forzar campeón**: `forceGroupWin(team)` (gana su grupo) + `simKnockouts(forced)` (gana todos sus partidos). Lo dispara `simAllBtn`/`simKoBtn` si `STATE.sim.champ` está seteado.
- **Render**: `rerender()` = `recompute()` + `renderHoy()` + `renderGroups()` + `renderKoList()` + `renderBracketGraph()` + `renderKoStatus()` + `renderArg()` + `updateChampion()`. Llamar **siempre `rerender()`** tras cambiar estado.
- **Solapa Hoy** (`renderHoy`): partidos del día en curso (día ART vía `dayKey`): los de grupos con `matchRow` (editables) y los de Fase Final como filas clickeables → `openMatch`. Si no hay partidos, muestra el próximo día con partidos.
- **Sección Argentina** (`renderArg`): estado en Grupo J, partidos de grupo, **camino real** según la simulación, y **escenarios** si sale 1º / 2º / 3º. Para 3º muestra los **5 caminos completos** posibles (slots M80/M81/M82/M85/M87) con `buildRoute()`. `argR32Starts()` detecta los slots de J en R32.
- **Cuadro gráfico** (`renderBracketGraph`): árbol absoluto con conectores SVG. Layout se computa una vez por DFS desde el partido 104 (`LAYOUT`, `FEEDERS`). El **3er puesto** es un recuadro chico, punteado y atenuado debajo de la final. Cada caja es clickeable → `openMatch(no)` (modal con día/hora ARG/sede).
- **Detalle de partido** (`openMatch`): modal con ronda, equipos, marcador, penales, día completo, hora ARG, sede.
- **Ajustes de azar** (`#cfgBg`, `applySimUI`): presets (det / K=7 / 4.4 / 3 / 1.6), slider de azar (K 1.2–8; ≥7.9 = det), slider **Historia↔Actualidad** (`wHist`), y selector de **campeón forzado**.
- **¿Cómo funciona?** (`renderInfo`): explica el modelo y muestra 4 rankings — Historia, Ranking FIFA, Apuestas, y la Mezcla del simulador — con sus fuentes.
- **Actualizar** (`updateResults`): fuente principal **Supabase** (proyecto del álbum, `zqwkznlgbkofsrygqezk`): edge function **`wc-sync`** que consulta TheSportsDB (liga FIFA World Cup = **4429**: `eventsseason` + `eventspastleague`), upserta partidos terminados en la tabla **`wc_results`** (RLS, solo lectura pública) y devuelve el historial completo. Un **pg_cron** (`wc_sync_daily`, 09:07 UTC = 06:07 ART, captura los partidos del día anterior) la llama solo → no se pierde nada aunque la app no se abra en días (la ventana de TheSportsDB cubre ~2,5 días, una pasada diaria sobra; además el botón Actualizar sincroniza en cada toque). Fallbacks en cadena: tabla `wc_results` por REST → TheSportsDB directo (ventana ~15 eventos). `applyEvents` aplica **grupos y Fase Final**: matchea por par de equipos (mapa `ALIAS`, `norm()` minúsculas + guiones→espacios) con kickoff a ±26 h; en KO resuelve equipos con `resolveKoTeam` (requiere grupos cargados) y si el evento empata deja penales/avanza para carga manual. No pisa resultados idénticos. Ojo: `eventsday.php` NO sirve — la key gratis lo limita a ~3 eventos/día (así se rompió la primera vez).

## Fuentes de los ratings (dejar siempre citado/aclarado en la app)
- **HIST (Historia/Mundiales)**: títulos (Brasil 5, Alemania 4, Argentina 3, Francia/Uruguay 2, Inglaterra/España 1) + tabla all-time de Mundiales (FIFA, planetfootball/Statista). Arriba Brasil y Alemania.
- **ACT (Actualidad)**: combina **Ranking FIFA** (1 abr 2026: Francia 1º, España 2º, Argentina 3º, Inglaterra 4º) + **favoritismo de apuestas** (jun 2026, FanDuel/CBS/FOX/Oddschecker: España +450 favorita, Francia, Inglaterra, Brasil, Portugal, Argentina). Arriba España.
- `FIFA_TOP` y `ODDS_TOP` son arrays solo para mostrar esos rankings de referencia en el modal.
- Son **estimación propia** a partir de esas fuentes, **no dato oficial** — mantener esa aclaración visible.

## Datos del fixture (cómo se armó)
Las 104 fechas/sedes/horarios y la estructura del cuadro (feeders no secuenciales, p.ej. R16 M95=W86 vs W88) se cruzaron entre NBC, Sky, ESPN, FourFourTwo y listados FIFA. Horarios originales en ET → guardados en UTC → mostrados en hora argentina.

## Limitaciones conocidas / decisiones
- Asignación de mejores terceros: válida (respeta elegibilidad) pero **aproxima** la tabla oficial FIFA (495 combinaciones no publicadas de forma verificable).
- Desempates de grupos **simplificados** (sin head-to-head/fair play/sorteo).
- "Actualizar" depende de que TheSportsDB tenga el dato (el cron de Supabase lo captura cada hora, así que el riesgo de la ventana de ~15 eventos quedó cubierto) → si falta algo, carga manual.
- El cron `wc_sync_daily` se **borra solo**: a partir del 21 jul 2026 (la final es el 19, la última sincronización útil corre el 20 a las 09:07 UTC) el propio job ejecuta `cron.unschedule('wc_sync_daily')` en lugar del sync. No hace falta limpiar nada a mano.
- Localía: plus fijo chico, no ajustable (se decidió que casi no importa).

## Gotchas
- **Filas de tabla**: construir el `<table>` completo como string y crearlo de una; inyectar `<tr>` suelto en un `<div>` lo descarta el parser. (Ya está resuelto en `renderGroups`.)
- Inputs de marcador/penales: `sanitizeScore()` fuerza entero 0–30 (sin negativos/decimales).
- Editar un marcador de **grupo** llama `clearKO()` (reinicia llaves) para evitar inconsistencias.
- Si cambiás el esquema de `STATE`, subí `STORE_KEY` (hoy `fixture2026_v2`) para no leer estado viejo incompatible.
- Tras cualquier cambio de estado: `persist()` + `rerender()`.

## Ideas/pendientes (opcionales)
- Refrescar valores de HIST/ACT con el ranking FIFA del 9–11 jun 2026 (sale justo antes del Mundial) y odds más recientes, citando.
- Compartir/exportar un cuadro simulado (imagen o link).
