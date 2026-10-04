# gcode-preview-react

A React component for [GCode Preview](https://github.com/xyz-tools/gcode-preview):
a 3D preview of G-code files, rendered with three.js into a `<canvas>`. It
creates and disposes the preview for you, loads a file from a URL or a string,
and keeps the preview in sync with its props.

Works with React 18 and 19, and in the Next.js App Router (the component is
marked `'use client'`).

## Install

```sh
npm install gcode-preview-react gcode-preview
```

`gcode-preview` (`^3.0.0-alpha.6`) and `react` are peer dependencies.

With TypeScript, also install `@types/three` to get strict types for the
color props (the core's option types come from three.js).

## Usage

```tsx
import { GCodePreview } from 'gcode-preview-react';

export function Viewer() {
  return (
    <GCodePreview
      src="/benchy.gcode"
      style={{ width: '100%', height: 400 }}
      buildVolume={{ x: 250, y: 220, z: 150, smallGrid: true }}
      topLayerColor="lime"
      onError={error => console.warn(error.message)}
    />
  );
}
```

## Props

### Loading

| Prop    | Type                 | Description                                                |
| ------- | -------------------- | ---------------------------------------------------------- |
| `src`   | `string \| URL`      | URL of a G-code file. It is fetched and streamed in.       |
| `gcode` | `string \| string[]` | G-code to process directly. If both are set, `gcode` wins. |

Changing `src` or `gcode` clears the preview and starts a new load; a load
that is still running is aborted. Unsetting both clears the preview. Pass a
stable array for `gcode` (for example from state or `useMemo`), since a new
array starts a new load.

### Preview options

Every option of the core `GCodePreview` (except `canvas`) is a prop, with the
type from `gcode-preview`. See the
[core documentation](https://gcode-preview.web.app/docs) for what each one
does. An option you don't pass is not passed to the core either, so the core
default applies.

**Live options** update the preview in place when the prop changes:

`buildVolume`, `backgroundColor`, `extrusionColor`, `travelColor`,
`topLayerColor`, `lastSegmentColor`, `boundingBoxColor`, `startLayer`,
`endLayer`, `renderExtrusion`, `renderTravel`, `renderTubes`, `lineWidth`,
`lineHeight`, `extrusionWidth`, `disableGradient`, `orthographic`, `devMode`

Only options whose value changed are applied. Objects and arrays such as
`buildVolume` and `extrusionColor` are compared one level deep, so passing
them inline is fine. `startLayer` and `endLayer` are applied again after each
load, because the core clamps them to the loaded layer count.

Changing a live option back to `undefined` resets it for `startLayer`,
`endLayer`, `topLayerColor`, `lastSegmentColor`, `boundingBoxColor`,
`buildVolume`, `lineHeight`, `extrusionWidth` and `devMode`. The other live
options keep their last value, because their core setters don't accept
`undefined`.

**Mount-only options** are read once, when the preview is created. Later
changes are ignored; remount the component (for example with a `key`) to
apply them:

`initialCameraPosition`, `minLayerThreshold`, `droppable`, `keepLines`,
`liveRenderInterval`, `arcChordTolerance`

### Canvas attributes

Any other canvas attribute (`className`, `style`, `id`, `tabIndex`, `aria-*`,
event handlers, ...) is passed to the `<canvas>`. It has
`aria-label="G-code preview"` unless you pass your own.

## Callbacks

| Prop      | Called with                 | When                                            |
| --------- | --------------------------- | ----------------------------------------------- |
| `onReady` | the `GCodePreview` instance | the preview has been created                    |
| `onLoad`  | the `GCodePreview` instance | `src` or `gcode` has been loaded and rendered   |
| `onError` | an `Error`                  | loading failed, e.g. `HTTP 404: /missing.gcode` |

Without an `onError` prop, load errors are logged with `console.error`. A load
that was replaced or whose component unmounted calls nothing. The latest
callbacks are always used, so inline functions don't recreate the preview.

## Instance access

The `ref` gives you the core `GCodePreview` instance, for anything the props
don't cover. It is set after mount (use it in an effect, an event handler or
`onReady`), and `null` after unmount.

```tsx
import type { GCodePreview as Preview } from 'gcode-preview';
import { GCodePreview } from 'gcode-preview-react';
import { useRef } from 'react';

function Viewer() {
  const preview = useRef<Preview>(null);
  return (
    <>
      <GCodePreview ref={preview} src="/benchy.gcode" />
      <button onClick={() => preview.current?.sceneManager.render()}>
        Render
      </button>
    </>
  );
}
```

## Sizing

The component renders a bare `<canvas>` without any size or stylesheet: size
the canvas with CSS (`className` or `style`). The preview follows the canvas
size through a `ResizeObserver`.

## Development

```sh
npm install
npm run dev
```

`npm run dev` starts the demo app (`src/App.tsx`) at http://localhost:5173. The
demo imports the component from source (`src/lib`). `npm run build:demo`
typechecks and builds the demo into `build/`, which is deployed to Firebase
Hosting.

| Script                 | What it does                                   |
| ---------------------- | ---------------------------------------------- |
| `npm run build`        | builds the library (`src/lib`) into `dist/`    |
| `npm test`             | runs the component tests (Vitest, core mocked) |
| `npm run typecheck`    | typechecks the demo, tests and library         |
| `npm run lint`         | ESLint + Prettier                              |
| `npm run lint:package` | checks the package setup with publint          |

The package is marked `"private": true` so it can't be published by accident.
Remove that flag when it is ready to be published; `prepack` builds the
library first.

The square and triangle towers in `public/` are small synthetic samples, not
printer-ready G-code.

## License

MIT
