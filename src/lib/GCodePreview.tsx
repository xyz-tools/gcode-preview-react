'use client';

import {
  GCodePreview as CorePreview,
  type GCodePreviewOptions
} from 'gcode-preview';
import {
  forwardRef,
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type ForwardedRef
} from 'react';

type Options = Omit<GCodePreviewOptions, 'canvas'>;

// Options with a live setter: a changed prop updates the preview in place.
const LIVE_OPTIONS = [
  'buildVolume',
  'backgroundColor',
  'extrusionColor',
  'travelColor',
  'topLayerColor',
  'lastSegmentColor',
  'boundingBoxColor',
  'startLayer',
  'endLayer',
  'renderExtrusion',
  'renderTravel',
  'renderTubes',
  'lineWidth',
  'lineHeight',
  'extrusionWidth',
  'disableGradient',
  'orthographic',
  'devMode'
] as const satisfies readonly (keyof Options)[];

// Options the core only reads in its constructor.
const MOUNT_OPTIONS = [
  'initialCameraPosition',
  'minLayerThreshold',
  'droppable',
  'keepLines',
  'liveRenderInterval',
  'arcChordTolerance'
] as const satisfies readonly (keyof Options)[];

type Unlisted = Exclude<
  keyof Options,
  (typeof LIVE_OPTIONS)[number] | (typeof MOUNT_OPTIONS)[number]
>;
// Fails the typecheck when the core gains an option that is in neither list.
const allListed: [Unlisted] extends [never] ? true : Unlisted = true;
void allListed;

type LiveOption = (typeof LIVE_OPTIONS)[number];

const OPTION_KEYS: ReadonlySet<string> = new Set([
  ...LIVE_OPTIONS,
  ...MOUNT_OPTIONS
]);

// Everything else is passed through to the canvas.
const OWN_PROPS: ReadonlySet<string> = new Set([
  ...OPTION_KEYS,
  'src',
  'gcode',
  'onReady',
  'onLoad',
  'onError'
]);

// The other setters do not accept undefined, so an unset prop keeps the last value.
const ACCEPTS_UNDEFINED: ReadonlySet<LiveOption> = new Set([
  'startLayer',
  'endLayer',
  'topLayerColor',
  'lastSegmentColor',
  'boundingBoxColor',
  'buildVolume',
  'lineHeight',
  'extrusionWidth',
  'devMode'
]);

type CanvasProps = Omit<
  ComponentPropsWithoutRef<'canvas'>,
  keyof Options | 'children' | 'onLoad' | 'onError'
>;

export interface GCodePreviewProps extends Options, CanvasProps {
  /** URL of a G-code file to fetch and stream in. Ignored when `gcode` is set. */
  src?: string | URL;
  /** G-code to process directly. Wins over `src`. */
  gcode?: string | string[];
  /** Called once the preview has been created. */
  onReady?: (preview: CorePreview) => void;
  /** Called after `src` or `gcode` has been loaded and rendered. */
  onLoad?: (preview: CorePreview) => void;
  /** Called when loading fails. Without it, the error is logged. */
  onError?: (error: Error) => void;
}

// Inline objects and arrays (buildVolume, extrusionColor, ...) are new on
// every render; compare them one level deep so their setters, some of which
// rebuild geometry, only run on a real change.
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every(key => Object.is(a[key], b[key]))
    );
  }
  return false;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function applyOption(preview: CorePreview, key: LiveOption, value: unknown) {
  if (key === 'devMode') {
    preview.devMode = value as Options['devMode'];
    return;
  }
  // Each key has its own setter type; the value comes from the matching prop.
  (preview.sceneManager as unknown as Record<string, unknown>)[key] = value;
}

function assignRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

export const GCodePreview = forwardRef<CorePreview, GCodePreviewProps>(
  function GCodePreview(props, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const previewRef = useRef<CorePreview | null>(null);
    const loadRef = useRef<AbortController | null>(null);
    const appliedRef = useRef<Partial<Record<LiveOption, unknown>>>({});
    // Whether the current preview holds content that an unset source clears.
    const loadedRef = useRef(false);
    // Callbacks and options are read from here at call time, so a new
    // callback identity never recreates the preview.
    const latest = useRef(props);

    useEffect(() => {
      latest.current = props;
    });

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const options: GCodePreviewOptions = { canvas };
      const applied: Partial<Record<LiveOption, unknown>> = {};
      for (const key of OPTION_KEYS) {
        const value = latest.current[key as keyof Options];
        if (value !== undefined) {
          (options as Record<string, unknown>)[key] = value;
        }
      }
      for (const key of LIVE_OPTIONS) applied[key] = latest.current[key];

      const preview = new CorePreview(options);
      previewRef.current = preview;
      appliedRef.current = applied;

      const observer = new ResizeObserver(() => preview.sceneManager.resize());
      observer.observe(canvas);

      latest.current.onReady?.(preview);

      return () => {
        loadRef.current?.abort();
        loadRef.current = null;
        loadedRef.current = false;
        observer.disconnect();
        previewRef.current = null;
        preview.dispose();
      };
    }, []);

    // Separate from the effect above so a new ref does not recreate the
    // preview; declared after it so the instance exists (also after a
    // StrictMode remount).
    useEffect(() => {
      assignRef(ref, previewRef.current);
      return () => assignRef(ref, null);
    }, [ref]);

    useEffect(() => {
      const preview = previewRef.current;
      if (!preview) return;
      for (const key of LIVE_OPTIONS) {
        const value = props[key];
        if (sameValue(value, appliedRef.current[key])) continue;
        appliedRef.current[key] = value;
        if (value === undefined && !ACCEPTS_UNDEFINED.has(key)) continue;
        applyOption(preview, key, value);
      }
    });

    // A URL object is new on every render; compare its string form instead.
    const src = props.src === undefined ? undefined : String(props.src);
    const { gcode } = props;
    const hasContent = gcode !== undefined || src !== undefined;

    useEffect(() => {
      const preview = previewRef.current;
      if (!preview) return;
      if (!hasContent) {
        if (loadedRef.current) preview.clear();
        loadedRef.current = false;
        return;
      }

      // The controller doubles as the load token: it is aborted when this
      // load is superseded or the component unmounts.
      loadRef.current?.abort();
      const controller = new AbortController();
      loadRef.current = controller;
      // Also cancels a stream that is still being read.
      preview.clear();
      loadedRef.current = true;

      async function load(preview: CorePreview) {
        try {
          if (gcode !== undefined) {
            await preview.processGCode(gcode);
          } else if (src !== undefined) {
            const response = await fetch(src, { signal: controller.signal });
            if (controller.signal.aborted) return;
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${src}`);
            }
            if (!response.body) throw new Error(`No response body: ${src}`);
            await preview.processGCodeStream(
              response.body.pipeThrough(new TextDecoderStream())
            );
          }
          if (controller.signal.aborted) return;
          // The layer setters clamp against the loaded job, so apply the
          // range again now that the job is complete.
          const { startLayer, endLayer, onLoad } = latest.current;
          preview.sceneManager.startLayer = startLayer;
          preview.sceneManager.endLayer = endLayer;
          appliedRef.current.startLayer = startLayer;
          appliedRef.current.endLayer = endLayer;
          onLoad?.(preview);
        } catch (cause) {
          if (controller.signal.aborted) return;
          const error =
            cause instanceof Error ? cause : new Error(String(cause));
          const { onError } = latest.current;
          if (onError) onError(error);
          else console.error(error);
        }
      }
      void load(preview);

      return () => controller.abort();
    }, [hasContent, src, gcode]);

    const canvasProps: Record<string, unknown> = {};
    for (const key in props) {
      if (!OWN_PROPS.has(key)) {
        canvasProps[key] = props[key as keyof GCodePreviewProps];
      }
    }

    return (
      <canvas aria-label="G-code preview" {...canvasProps} ref={canvasRef} />
    );
  }
);
