import { GCodePreview } from 'gcode-preview';
import { useEffect, useRef, useState } from 'react';

interface GCodePreviewProps {
  src: string;
  topLayerColor?: string;
  lastSegmentColor?: string;
  startLayer?: number;
  endLayer?: number;
  lineWidth?: number;
}

export default function GCodePreviewUI({
  src,
  topLayerColor = 'lime',
  lastSegmentColor = 'red',
  startLayer,
  endLayer,
  lineWidth = 1
}: GCodePreviewProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const controller = new AbortController();
    const preview = new GCodePreview({
      canvas: canvasRef.current,
      lineWidth,
      topLayerColor,
      lastSegmentColor,
      buildVolume: { x: 250, y: 220, z: 150, smallGrid: true },
      initialCameraPosition: [0, 400, 450],
      droppable: false
    });
    const resize = () => preview.sceneManager.resize();
    window.addEventListener('resize', resize);
    setError('');
    setLoading(true);

    async function load() {
      try {
        const response = await fetch(src, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${src}`);
        if (!response.body)
          throw new Error('The response has no G-code stream.');
        await preview.processGCodeStream(
          response.body.pipeThrough(new TextDecoderStream())
        );
        if (controller.signal.aborted) return;
        // Apply the range after loading so it is clamped against the full job.
        preview.sceneManager.startLayer = startLayer;
        preview.sceneManager.endLayer = endLayer;
        preview.sceneManager.render();
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();

    return () => {
      controller.abort();
      window.removeEventListener('resize', resize);
      preview.dispose();
    };
  }, [src, topLayerColor, lastSegmentColor, startLayer, endLayer, lineWidth]);

  return (
    <div className="gcode-preview">
      <canvas ref={canvasRef} aria-label={`G-code preview: ${src}`} />
      {loading && <p role="status">Loading G-code…</p>}
      {error && <p role="alert">{error}</p>}
      <div>topLayerColor: {topLayerColor}</div>
      <div>lastSegmentColor: {lastSegmentColor}</div>
      <div>startLayer: {startLayer ?? 'first'}</div>
      <div>endLayer: {endLayer ?? 'last'}</div>
      <div>lineWidth: {lineWidth}</div>
    </div>
  );
}
