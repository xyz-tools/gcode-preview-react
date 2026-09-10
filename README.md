# GCode Preview 3.0 with React & TypeScript

This demo uses [GCode Preview](https://github.com/xyz-tools/gcode-preview)
`3.0.0-alpha.6` with a React 19 / TypeScript / Vite setup.

```sh
npm install
npm start
```

Open http://localhost:5173. `npm run build` typechecks and creates the
production build in `build/`, which `npm run preview` serves. `npm run lint`
checks the source and `npm test` runs the lifecycle regression tests (Vitest).

## Component

```tsx
import GCodePreview from './components/GCodePreview';

<GCodePreview
  src={`${import.meta.env.BASE_URL}square-tower.gcode`}
  topLayerColor="lime"
  lastSegmentColor="red"
  startLayer={20}
  endLayer={150}
/>
```

The wrapper creates a `new GCodePreview(...)` after the canvas mounts and
passes a decoded fetch stream to `processGCodeStream`. Source or option changes
reload the preview. Layer ranges are applied through `preview.sceneManager`
after loading, when the complete layer count is known. Loading failures appear
below the canvas. Cleanup aborts fetch, removes the resize listener and calls
`preview.dispose()`, including during React Strict Mode remounts.

The local square and triangle towers are small synthetic preview samples, not
printer-ready G-code. Put your own files in `public/` and change `src` to use them.
