import { useState, type JSX } from 'react';

import { GCodePreview } from './lib';
import './styles.css';

const samples = [
  {
    name: 'Square tower',
    file: 'square-tower.gcode',
    topLayerColor: 'lime',
    lastSegmentColor: 'red',
    startLayer: 20,
    endLayer: 150
  },
  {
    name: 'Triangle tower',
    file: 'triangle-tower.gcode',
    topLayerColor: 'purple',
    lastSegmentColor: 'cyan'
  }
];

type Status =
  | { state: 'loading' }
  | { state: 'loaded' }
  | { state: 'error'; message: string };

function App(): JSX.Element {
  const [sample, setSample] = useState(samples[0]);
  const [status, setStatus] = useState<Status>({ state: 'loading' });

  function select(next: (typeof samples)[number]) {
    setSample(next);
    setStatus({ state: 'loading' });
  }

  return (
    <div className="app">
      <h1>GCode Preview 3.0 React & TypeScript Demo</h1>
      <div className="samples">
        {samples.map(s => (
          <button
            key={s.file}
            type="button"
            aria-pressed={s === sample}
            onClick={() => select(s)}
          >
            {s.name}
          </button>
        ))}
      </div>
      <GCodePreview
        className="gcode-preview"
        src={`${import.meta.env.BASE_URL}${sample.file}`}
        buildVolume={{ x: 250, y: 220, z: 150, smallGrid: true }}
        initialCameraPosition={[0, 400, 450]}
        lineWidth={1}
        topLayerColor={sample.topLayerColor}
        lastSegmentColor={sample.lastSegmentColor}
        startLayer={sample.startLayer}
        endLayer={sample.endLayer}
        onLoad={() => setStatus({ state: 'loaded' })}
        onError={error => setStatus({ state: 'error', message: error.message })}
      />
      {status.state === 'loading' && <p role="status">Loading G-code…</p>}
      {status.state === 'error' && <p role="alert">{status.message}</p>}
      <p>
        Layers {sample.startLayer ?? 'first'} to {sample.endLayer ?? 'last'}
      </p>
    </div>
  );
}

export default App;
