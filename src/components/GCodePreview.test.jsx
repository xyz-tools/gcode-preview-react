import { StrictMode, act } from 'react';
import { createRoot } from 'react-dom/client';
import { GCodePreview } from 'gcode-preview';
import Preview from './GCodePreview';

vi.mock('gcode-preview', () => ({ GCodePreview: vi.fn() }));

let container;
let root;
let instances;
const originalFetch = globalThis.fetch;
const originalDecoder = globalThis.TextDecoderStream;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.TextDecoderStream = class {};
  instances = [];
  vi.mocked(GCodePreview).mockImplementation(function () {
    const instance = {
      processGCodeStream: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn(),
      sceneManager: { resize: vi.fn(), render: vi.fn() }
    };
    instances.push(instance);
    return instance;
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  globalThis.fetch = originalFetch;
  globalThis.TextDecoderStream = originalDecoder;
  vi.clearAllMocks();
});

function response() {
  return { ok: true, body: { pipeThrough: vi.fn(() => 'decoded stream') } };
}

test('streams decoded text, applies layers after loading, and cleans up', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue(response());
  await act(async () => {
    root.render(<Preview src="/sample.gcode" startLayer={20} endLayer={150} />);
  });
  const preview = instances[0];
  expect(preview.processGCodeStream).toHaveBeenCalledWith('decoded stream');
  expect(preview.sceneManager.startLayer).toBe(20);
  expect(preview.sceneManager.endLayer).toBe(150);
  expect(container.querySelector('[role="status"]')).toBeNull();
  window.dispatchEvent(new Event('resize'));
  expect(preview.sceneManager.resize).toHaveBeenCalledTimes(1);
  await act(async () => root.render(null));
  expect(globalThis.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  expect(preview.dispose).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event('resize'));
  expect(preview.sceneManager.resize).toHaveBeenCalledTimes(1);
});

test('ignores a late response from a replaced source', async () => {
  let resolveOld;
  globalThis.fetch = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveOld = resolve;
        })
    )
    .mockResolvedValue(response());
  await act(async () => root.render(<Preview src="/old.gcode" />));
  await act(async () => root.render(<Preview src="/new.gcode" />));
  await act(async () => resolveOld(response()));
  expect(instances[0].dispose).toHaveBeenCalledTimes(1);
  expect(instances[0].processGCodeStream).not.toHaveBeenCalled();
  expect(instances[1].processGCodeStream).toHaveBeenCalledTimes(1);
});

test('reports failed loads', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
  await act(async () => root.render(<Preview src="/missing.gcode" />));
  expect(container.querySelector('[role="alert"]').textContent).toContain(
    'HTTP 404'
  );
});

test('survives Strict Mode effect replay without loading a disposed preview', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue(response());
  await act(async () =>
    root.render(
      <StrictMode>
        <Preview src="/sample.gcode" />
      </StrictMode>
    )
  );
  expect(instances).toHaveLength(2);
  expect(instances[0].dispose).toHaveBeenCalledTimes(1);
  expect(instances[0].processGCodeStream).not.toHaveBeenCalled();
  expect(instances[1].processGCodeStream).toHaveBeenCalledTimes(1);
});
