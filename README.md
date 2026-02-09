# Pyatigorsk GO (PWA)

Мини‑игра в стиле “Pokémon GO”, только вместо покемонов — **достопримечательности Пятигорска**.

## Что уже работает (MVP)

- Карта (OpenStreetMap) + точки‑достопримечательности
- Геолокация (GPS) + проверка расстояния и радиуса
- “Открытие” точки и начисление XP
- Коллекция (что открыто / что закрыто)
- PWA (manifest + service worker + offline app shell)

## Запуск

```bash
npm install
npm run dev
```

Сборка:

```bash
npm run build
npm run preview
```

## Деплой в подпапку (например, на существующем сайте Reg.ru)

Если нужно открыть приложение по адресу вида `https://site.ru/pyatigorsk-go/`, собирай с `PWA_BASE`.

Пример (папка `pyatigorsk-go`):

```bash
PWA_BASE=/pyatigorsk-go/ npm run build
```

Дальше **содержимое** папки `dist/` загрузи на хостинг в папку `pyatigorsk-go` в корне сайта, чтобы получилось:

- `.../pyatigorsk-go/index.html`
- `.../pyatigorsk-go/assets/...`
- `.../pyatigorsk-go/sw.js`
- `.../pyatigorsk-go/manifest.webmanifest`

## Важно про GPS

Геолокация в браузере требует **secure context** (HTTPS), исключение — `localhost`.

- На компьютере: `http://localhost:5173` — GPS работает.
- На телефоне: лучше запускать на **HTTPS** (например, задеплоить на хостинг или использовать https‑туннель).

## Где лежат точки

Список достопримечательностей и координаты: `src/data/landmarks.ts`.

## Яндекс.Карта (вместо OSM)

По умолчанию приложение использует **Яндекс Tiles API**, если задан ключ `VITE_YANDEX_TILES_API_KEY`.
Если ключ не задан — будет показана карта **OSM**.

Создай `.env` по примеру `.env.example` и укажи ключ:

```bash
VITE_YANDEX_TILES_API_KEY="..."
```

## Google Maps (вместо остальных карт)

Если задан `VITE_GOOGLE_MAPS_API_KEY`, приложение будет использовать **Google Maps JavaScript API**.

```bash
VITE_GOOGLE_MAPS_API_KEY="..."
```

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
