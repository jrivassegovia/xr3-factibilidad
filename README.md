# XR3 · Factibilidad FTTH (app de técnicos)

App web instalable (PWA) para que el técnico en terreno encuentre CTO cercanas con instalaciones recientes cuando no puede conectar un domicilio.

- Busca con la **OT**, con la **ubicación GPS** del celular o con **comuna + dirección**.
- Muestra la **mejor opción**: Puerto NAP, distancia en línea recta y por calles, ocupación de puertos (Consulta Vecino), botón **Cómo llegar** y **Compartir** por WhatsApp.
- No contiene datos de clientes: cada búsqueda se resuelve en el servicio de Apps Script de XR3, que devuelve solo el resultado de ese caso.

## Archivos

| Archivo | Para qué |
|---|---|
| `index.html` | Pantalla de la app |
| `app.js` | Lógica: búsqueda, GPS, mapa, compartir |
| `config.js` | **URL del servicio** (lo único que se edita) |
| `manifest.webmanifest`, `icons/` | Nombre e ícono al instalar |
| `sw.js` | Permite abrir la app rápido y sin señal (las búsquedas sí necesitan internet) |

## Configurar

1. En `config.js`, pega en `API_URL` la URL `/exec` de la Aplicación web **XR3 Factibilidad API**.
2. Publica con GitHub Pages: **Settings → Pages → Deploy from a branch → main / (root) → Save**.
3. La app queda en `https://<usuario>.github.io/<repositorio>/`.

## Instalar en el celular

- **Android (Chrome):** abre la dirección → menú ⋮ → **Instalar app** (o "Agregar a la pantalla principal").
- **iPhone (Safari):** abre la dirección → Compartir → **Agregar a inicio**.

La primera vez que se usa la ubicación, el celular pide permiso: hay que aceptarlo.

## Actualizar

Al cambiar un archivo en GitHub, la app se actualiza sola la próxima vez que el técnico la abra con señal. Si se cambia `sw.js`, sube el número de `VERSION`.
