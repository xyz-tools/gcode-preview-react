import { GCodePreview } from 'gcode-preview';
import { forwardRef, Ref, useEffect, useImperativeHandle, useRef } from 'react';

interface GCodePreviewProps {
  topLayerColor?: string;
  lastSegmentColor?: string;
  startLayer?: number;
  endLayer?: number;
  lineWidth?: number;
}

interface GCodePreviewHandle {
  getLayerCount: () => number;
  load: (gcode: string | string[] | ReadableStream) => Promise<void>;
}

function GCodePreviewUI(
  props: GCodePreviewProps,
  ref: Ref<GCodePreviewHandle>
): JSX.Element {
  const { topLayerColor, lastSegmentColor, startLayer, endLayer, lineWidth } =
    props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<GCodePreview | null>(null);

  useImperativeHandle(ref, () => ({
    getLayerCount() {
      return previewRef.current?.countLayers as number;
    },
    async load(gcode) {
      const preview = previewRef.current;
      if (!preview) return;
      // state persists between loads, so start from a clean job.
      // clear() also cancels a stream that is still being read.
      preview.clear();
      await preview.processGCodeStream(gcode);
    }
  }));

  useEffect(() => {
    const preview = new GCodePreview({
      canvas: canvasRef.current as HTMLCanvasElement,
      startLayer,
      endLayer,
      lineWidth,
      topLayerColor,
      lastSegmentColor,
      buildVolume: { x: 250, y: 220, z: 150, smallGrid: false },
      initialCameraPosition: [0, 400, 450],
      droppable: false
    });
    previewRef.current = preview;

    const resizePreview = () => preview.sceneManager.resize();
    window.addEventListener('resize', resizePreview);

    return () => {
      window.removeEventListener('resize', resizePreview);
      previewRef.current = null;
      preview.dispose();
    };
  }, []);

  return (
    <div className="gcode-preview">
      <canvas ref={canvasRef}></canvas>

      <div>
        <div>topLayerColor: {topLayerColor}</div>
        <div>lastSegmentColor: {lastSegmentColor}</div>
        <div>startLayer: {startLayer}</div>
        <div>endLayer: {endLayer}</div>
        <div>lineWidth: {lineWidth}</div>
      </div>
    </div>
  );
}

export default forwardRef(GCodePreviewUI);
