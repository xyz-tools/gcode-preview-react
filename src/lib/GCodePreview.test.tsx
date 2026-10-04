import { GCodePreview as CorePreview } from 'gcode-preview';
import { StrictMode, act, createRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Mock } from 'vitest';
import { GCodePreview } from './index';

vi.mock('gcode-preview', () => ({ GCodePreview: vi.fn() }));

interface MockPreview {
  options: Record<string, unknown>;
  processGCode: Mock;
  processGCodeStream: Mock;
  clear: Mock;
  dispose: Mock;
  devMode?: unknown;
  sceneManager: Record<string, unknown> & { resize: Mock };
}

let container: HTMLDivElement;
let root: Root;
let instances: MockPreview[];
// Every setter call and core method call, in order.
let log: string[];
let observers: MockResizeObserver[];
const originalFetch = globalThis.fetch;

class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(public callback: () => void) {
    observers.push(this);
  }
}

class MockTextDecoderStream {}

function recording<T extends object>(target: T, prefix: string): T {
  return new Proxy(target, {
    set(obj, key, value) {
      log.push(
        `${prefix}${String(key)}=${JSON.stringify(value) ?? 'undefined'}`
      );
      return Reflect.set(obj, key, value);
    }
  });
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.stubGlobal('TextDecoderStream', MockTextDecoderStream);
  instances = [];
  log = [];
  observers = [];
  vi.mocked(CorePreview).mockImplementation(function (
    options: Record<string, unknown>
  ) {
    const instance: MockPreview = {
      options,
      processGCode: vi.fn(async () => void log.push('processGCode')),
      processGCodeStream: vi.fn(
        async () => void log.push('processGCodeStream')
      ),
      clear: vi.fn(() => void log.push('clear')),
      dispose: vi.fn(),
      sceneManager: recording({ resize: vi.fn() }, '')
    };
    const preview = recording(instance, 'preview.');
    instances.push(preview);
    return preview;
  } as never);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  globalThis.fetch = originalFetch;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

async function render(element: ReactNode) {
  await act(async () => root.render(element));
}

function response() {
  return { ok: true, body: { pipeThrough: vi.fn(() => 'decoded stream') } };
}

function mockFetch(...responses: unknown[]) {
  const fetch = vi.fn();
  for (const r of responses) fetch.mockImplementationOnce(() => r);
  fetch.mockImplementation(() => Promise.resolve(response()));
  globalThis.fetch = fetch;
  return fetch;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => (resolve = r));
  return { promise, resolve };
}

test('creates the preview with the canvas and the given options only', async () => {
  mockFetch();
  const onReady = vi.fn();
  await render(
    <GCodePreview
      src="/a.gcode"
      lineWidth={2}
      topLayerColor="lime"
      buildVolume={{ x: 200, y: 200, z: 180, smallGrid: false }}
      initialCameraPosition={[0, 400, 450]}
      renderTravel={false}
      onReady={onReady}
      onLoad={() => {}}
      onError={() => {}}
      className="viewer"
      id="preview"
    />
  );
  const canvas = container.querySelector('canvas')!;
  expect(instances).toHaveLength(1);
  expect(instances[0].options).toEqual({
    canvas,
    lineWidth: 2,
    topLayerColor: 'lime',
    buildVolume: { x: 200, y: 200, z: 180, smallGrid: false },
    initialCameraPosition: [0, 400, 450],
    renderTravel: false
  });
  expect('renderExtrusion' in instances[0].options).toBe(false);
  expect(onReady).toHaveBeenCalledWith(instances[0]);
  expect(canvas.className).toBe('viewer');
  expect(canvas.id).toBe('preview');
  expect(canvas.getAttribute('aria-label')).toBe('G-code preview');
  expect(canvas.hasAttribute('src')).toBe(false);
  expect(container.children).toHaveLength(1);

  await render(<GCodePreview aria-label="Benchy" />);
  expect(canvas.getAttribute('aria-label')).toBe('Benchy');
});

test('streams a decoded src, then applies the layer range and calls onLoad', async () => {
  const res = response();
  const fetch = mockFetch(Promise.resolve(res));
  const onLoad = vi.fn();
  await render(
    <GCodePreview
      src={new URL('https://example.com/a.gcode')}
      startLayer={20}
      endLayer={150}
      onLoad={onLoad}
    />
  );
  const preview = instances[0];
  expect(fetch).toHaveBeenCalledWith('https://example.com/a.gcode', {
    signal: expect.any(AbortSignal)
  });
  expect(res.body.pipeThrough).toHaveBeenCalledWith(
    expect.any(MockTextDecoderStream)
  );
  expect(preview.processGCodeStream).toHaveBeenCalledWith('decoded stream');
  expect(log).toEqual([
    'clear',
    'processGCodeStream',
    'startLayer=20',
    'endLayer=150'
  ]);
  expect(onLoad).toHaveBeenCalledExactlyOnceWith(preview);
});

test('processes gcode directly, and gcode wins over src', async () => {
  const fetch = mockFetch();
  const onLoad = vi.fn();
  await render(
    <GCodePreview src="/a.gcode" gcode="G1 X1" endLayer={3} onLoad={onLoad} />
  );
  const preview = instances[0];
  expect(fetch).not.toHaveBeenCalled();
  expect(preview.processGCode).toHaveBeenCalledWith('G1 X1');
  expect(log).toEqual([
    'clear',
    'processGCode',
    'startLayer=undefined',
    'endLayer=3'
  ]);
  expect(onLoad).toHaveBeenCalledWith(preview);

  // Unsetting both clears the preview.
  log.length = 0;
  await render(<GCodePreview endLayer={3} />);
  expect(log).toEqual(['clear']);
});

test('does not load or clear without src or gcode', async () => {
  const fetch = mockFetch();
  await render(<GCodePreview />);
  expect(fetch).not.toHaveBeenCalled();
  expect(instances[0].clear).not.toHaveBeenCalled();
  expect(instances[0].processGCode).not.toHaveBeenCalled();
});

test('replacing src aborts the old fetch and ignores its late response', async () => {
  const old = deferred<ReturnType<typeof response>>();
  const oldResponse = response();
  const fetch = mockFetch(old.promise);
  const onLoad = vi.fn();
  await render(<GCodePreview src="/old.gcode" onLoad={onLoad} />);
  await render(<GCodePreview src="/new.gcode" onLoad={onLoad} />);
  const oldSignal: AbortSignal = fetch.mock.calls[0][1].signal;
  expect(oldSignal.aborted).toBe(true);
  expect(fetch.mock.calls[1][1].signal.aborted).toBe(false);

  await act(async () => old.resolve(oldResponse));
  expect(instances).toHaveLength(1);
  expect(oldResponse.body.pipeThrough).not.toHaveBeenCalled();
  expect(instances[0].processGCodeStream).toHaveBeenCalledTimes(1);
  expect(instances[0].clear).toHaveBeenCalledTimes(2);
  expect(onLoad).toHaveBeenCalledTimes(1);
});

test('applies only changed live options and ignores mount-only options', async () => {
  const onReady = vi.fn();
  const props = {
    buildVolume: { x: 200, y: 200, z: 180, smallGrid: false },
    extrusionColor: ['red', 'blue'],
    topLayerColor: 'lime',
    renderTravel: true,
    initialCameraPosition: [0, 1, 2],
    droppable: false
  };
  await render(<GCodePreview {...props} onReady={onReady} />);
  const preview = instances[0];
  expect(log).toEqual([]);

  // Equal inline objects/arrays and a new callback identity change nothing.
  await render(
    <GCodePreview
      {...props}
      buildVolume={{ x: 200, y: 200, z: 180, smallGrid: false }}
      extrusionColor={['red', 'blue']}
      onReady={() => {}}
    />
  );
  expect(log).toEqual([]);

  props.topLayerColor = 'purple';
  await render(<GCodePreview {...props} />);
  expect(log).toEqual(['topLayerColor="purple"']);

  log.length = 0;
  await render(<GCodePreview {...props} devMode />);
  expect(log).toEqual(['preview.devMode=true']);

  log.length = 0;
  await render(
    <GCodePreview
      {...props}
      devMode
      initialCameraPosition={[9, 9, 9]}
      droppable
    />
  );
  expect(log).toEqual([]);

  // Setters that accept undefined get it; the others keep their value.
  log.length = 0;
  await render(
    <GCodePreview
      {...props}
      devMode
      topLayerColor={undefined}
      renderTravel={undefined}
    />
  );
  expect(log).toEqual(['topLayerColor=undefined']);

  expect(instances).toHaveLength(1);
  expect(preview.dispose).not.toHaveBeenCalled();
  expect(onReady).toHaveBeenCalledTimes(1);
});

test('reports a failed fetch to onError', async () => {
  mockFetch(Promise.resolve({ ok: false, status: 404 }));
  const onError = vi.fn();
  const onLoad = vi.fn();
  await render(
    <GCodePreview src="/missing.gcode" onError={onError} onLoad={onLoad} />
  );
  expect(onError).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
  expect(onError.mock.calls[0][0].message).toBe('HTTP 404: /missing.gcode');
  expect(onLoad).not.toHaveBeenCalled();
});

test('logs a failed load without an error handler', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  mockFetch(Promise.resolve({ ok: false, status: 404 }));
  await render(<GCodePreview src="/missing.gcode" />);
  expect(consoleError).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
  expect(consoleError.mock.calls[0][0].message).toBe(
    'HTTP 404: /missing.gcode'
  );
});

test('resizes on ResizeObserver and cleans up on unmount', async () => {
  const fetch = mockFetch(new Promise(() => {}));
  const onLoad = vi.fn();
  await render(<GCodePreview src="/a.gcode" onLoad={onLoad} />);
  const preview = instances[0];
  const canvas = container.querySelector('canvas');
  expect(observers).toHaveLength(1);
  expect(observers[0].observe).toHaveBeenCalledWith(canvas);
  observers[0].callback();
  expect(preview.sceneManager.resize).toHaveBeenCalledTimes(1);

  await render(null);
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  expect(preview.dispose).toHaveBeenCalledTimes(1);
  expect(onLoad).not.toHaveBeenCalled();
});

test('ignores a load that finishes after unmount', async () => {
  const done = deferred<void>();
  mockFetch();
  const onLoad = vi.fn();
  await render(<GCodePreview gcode="G1 X1" onLoad={onLoad} />);
  instances[0].processGCode.mockReturnValueOnce(done.promise);
  await render(<GCodePreview gcode="G1 X2" onLoad={onLoad} />);
  onLoad.mockClear();
  log.length = 0;
  await render(null);
  await act(async () => done.resolve());
  expect(onLoad).not.toHaveBeenCalled();
  expect(log).toEqual([]);
});

test('exposes the preview instance through ref', async () => {
  const ref = createRef<CorePreview>();
  await render(<GCodePreview ref={ref} />);
  expect(ref.current).toBe(instances[0]);
  await render(null);
  expect(ref.current).toBeNull();
});

test('points the ref at the live preview under StrictMode', async () => {
  mockFetch();
  const ref = createRef<CorePreview>();
  const callbackRef = vi.fn();
  await render(
    <StrictMode>
      <GCodePreview ref={ref} src="/a.gcode" />
      <GCodePreview ref={callbackRef} />
    </StrictMode>
  );
  const live = instances.filter(i => !i.dispose.mock.calls.length);
  expect(live).toHaveLength(2);
  expect(ref.current).toBe(live[0]);
  expect(callbackRef).toHaveBeenLastCalledWith(live[1]);
  for (const instance of instances) {
    const loads = instance.processGCodeStream.mock.calls.length;
    expect(loads).toBe(instance === live[0] ? 1 : 0);
  }
});
