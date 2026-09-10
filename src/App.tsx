import type { JSX } from 'react';

import GCodePreview from './components/GCodePreview';
import './styles.css';

function App(): JSX.Element {
  return (
    <div className="app">
      <h1>GCode Preview 3.0 React & TypeScript Demo</h1>
      <GCodePreview
        src={`${import.meta.env.BASE_URL}square-tower.gcode`}
        topLayerColor="lime"
        lastSegmentColor="red"
        startLayer={20}
        endLayer={150}
      />
      <GCodePreview
        src={`${import.meta.env.BASE_URL}triangle-tower.gcode`}
        topLayerColor="purple"
        lastSegmentColor="cyan"
      />
    </div>
  );
}

export default App;
