import { useRef, useState } from 'react';
import { TopToolbar } from './components/TopToolbar';
import { LibrarySidebar } from './components/LibrarySidebar';
import { DiagramCanvas } from './components/Canvas/DiagramCanvas';
import { PropertiesPanel } from './components/PropertiesPanel';
import { type BuilderMode, ElementBuilderModal } from './components/ElementBuilderModal';
import { ExportModal } from './components/ExportModal';
import { useDiagramStore } from './store/useDiagramStore';

export function App() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [builderMode, setBuilderMode] = useState<BuilderMode | null>(null);
  const [exportTab, setExportTab] = useState<'png' | 'pdf' | null>(null);

  const { addTemplate, updateTemplate, updateElementPins } = useDiagramStore();

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <TopToolbar onOpenExport={(tab) => setExportTab(tab)} />

      <div className="flex flex-1 overflow-hidden">
        <LibrarySidebar
          onOpenCreateElement={() => setBuilderMode({ type: 'create' })}
          onOpenEditTemplate={(template) =>
            setBuilderMode({ type: 'edit-template', template })
          }
          onOpenDuplicateTemplate={(template) =>
            setBuilderMode({ type: 'duplicate-template', template })
          }
        />

        <DiagramCanvas svgRef={svgRef} />

        <PropertiesPanel
          onEditInstancePins={(element) =>
            setBuilderMode({ type: 'edit-instance', element })
          }
        />
      </div>

      {builderMode && (
        <ElementBuilderModal
          mode={builderMode}
          onClose={() => setBuilderMode(null)}
          onSaveTemplate={(data, editId) => {
            if (editId) {
              updateTemplate(editId, data);
            } else {
              addTemplate(data);
            }
          }}
          onSaveInstancePins={(instanceId, pins, width, height) => {
            updateElementPins(instanceId, pins, width, height);
          }}
        />
      )}

      {exportTab && (
        <ExportModal
          initialTab={exportTab}
          svgRef={svgRef}
          onClose={() => setExportTab(null)}
        />
      )}
    </div>
  );
}

export default App;
