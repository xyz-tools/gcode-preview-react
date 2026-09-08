import React, { useEffect, useRef } from 'react';
import GCodePreview from './components/GCodePreview';
import './styles.css';

type GCodePreviewHandle = React.ElementRef<typeof GCodePreview>;

// gcode-preview 3.x reads the stream itself and renders progressively while it
// parses, so no manual chunking is needed. The stream has to be decoded to text
// first: the parser splits chunks on '\n' and would silently render nothing if
// it were handed raw bytes.
const loadGcode = async (
  target: React.RefObject<GCodePreviewHandle>,
  url: string,
  signal: AbortSignal
) => {
  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) {
    throw new Error(
      `status code: ${response.status}, status text: ${response.statusText}`
    );
  }
  // the load may have been superseded while the file was in flight
  if (signal.aborted) return;
  await target.current?.load(
    response.body.pipeThrough(new TextDecoderStream())
  );
};

function App(): JSX.Element {
  const gcodePreviewRef1 = useRef<GCodePreviewHandle | null>(null);
  const gcodePreviewRef2 = useRef<GCodePreviewHandle | null>(null);
  // const [layersLoaded, setLayerLoaded] = useState<number>();

  useEffect(() => {
    const controller = new AbortController();

    async function init() {
      await loadGcode(gcodePreviewRef1, '/benchy.gcode', controller.signal);
      await loadGcode(
        gcodePreviewRef2,
        '/duplo_tracks.gcode',
        controller.signal
      );
    }

    init().catch(err => {
      if ((err as Error).name !== 'AbortError') console.error(err);
    });

    return () => controller.abort();
  }, []);

  return (
    <div className="app">
      <h1>GCode Preview React & TypeScript Demo</h1>

      <GCodePreview
        ref={gcodePreviewRef1}
        topLayerColor="lime"
        lastSegmentColor="red"
        startLayer={20}
        endLayer={150}
      />

      <GCodePreview
        ref={gcodePreviewRef2}
        topLayerColor="purple"
        lastSegmentColor="cyan"
      />

      {/* <div># layers loaded: {layersLoaded}</div> */}
    </div>
  );
}

export default App;
