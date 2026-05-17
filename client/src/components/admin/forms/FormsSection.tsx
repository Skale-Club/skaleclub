import { useLocation } from 'wouter';
import { FormsList } from './FormsList';
import { FormEditorView } from './FormEditorView';

export function FormsSection() {
  const [location, setLocation] = useLocation();

  // Sub-route detection: /admin/forms/:id
  const editingIdMatch = location.match(/^\/admin\/forms\/(\d+)/);
  const editingId = editingIdMatch ? Number(editingIdMatch[1]) : null;

  if (editingId != null) {
    return <FormEditorView formId={editingId} onBack={() => setLocation('/admin/forms')} />;
  }
  return <FormsList onOpen={(id) => setLocation(`/admin/forms/${id}`)} />;
}
