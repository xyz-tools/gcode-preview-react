import GCodePreview from './components/GCodePreview';
import './styles.css';

function App(): JSX.Element {
  return (
    <div className="app">
      <h1>GCode Preview 3.0 React & TypeScript Demo</h1>
      <GCodePreview
        src={`${process.env.PUBLIC_URL}/square-tower.gcode`}
        topLayerColor="lime"
        lastSegmentColor="red"
        startLayer={20}
        endLayer={150}
      />
      <GCodePreview
        src={`${process.env.PUBLIC_URL}/triangle-tower.gcode`}
        topLayerColor="purple"
        lastSegmentColor="cyan"
      />
    </div>
  );
}

export default App;
