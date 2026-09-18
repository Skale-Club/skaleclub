import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SECTION_LABEL, type PortfolioFieldsProps } from './portfolioFormTypes';

/** "Live at" links listed in the popup. */
export function ServicePopupUrlsField({ formData, setFormData }: PortfolioFieldsProps) {
    const [urlInput, setUrlInput] = useState('');
    const urls = formData.popupUrls ?? [];

    const addUrl = () => {
        const value = urlInput.trim();
        if (!value) return;
        setFormData(prev => ({ ...prev, popupUrls: [...(prev.popupUrls ?? []), value] }));
        setUrlInput('');
    };

    return (
        <div className="space-y-3">
            <p className={SECTION_LABEL}>Popup | URLs / Links</p>
            <p className="text-xs text-muted-foreground">Sites que já usam o produto, listados no popup.</p>
            {urls.length > 0 && (
                <div className="space-y-2">
                    {urls.map((url, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <Input
                                value={url}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setFormData(prev => {
                                        const updated = [...(prev.popupUrls ?? [])];
                                        updated[idx] = value;
                                        return { ...prev, popupUrls: updated };
                                    });
                                }}
                                placeholder="exemplo.com"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0 text-red-500"
                                onClick={() => setFormData(prev => ({ ...prev, popupUrls: (prev.popupUrls ?? []).filter((_, i) => i !== idx) }))}
                                aria-label="Remover URL"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex gap-2">
                <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Adicionar URL..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
                />
                <Button type="button" variant="secondary" onClick={addUrl}>Add</Button>
            </div>
        </div>
    );
}
