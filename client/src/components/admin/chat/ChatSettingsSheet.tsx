import type { Dispatch, RefObject, SetStateAction, ChangeEvent } from 'react';
import { LayoutGrid, Settings, User } from 'lucide-react';
import { SiGoogle, SiOpenai } from 'react-icons/si';
import { Link } from 'wouter';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from '@/components/ui/loader';
import { clsx } from 'clsx';
import { DEFAULT_CHAT_OBJECTIVES } from '../shared/constants';
import { ChatSortableObjectiveItem } from './ChatSortableObjectiveItem';
import type { ChatSettingsData, IntakeObjective } from '../shared/types';

export type ChatSettingsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settingsDraft: ChatSettingsData;
  onSettingsDraftChange: Dispatch<SetStateAction<ChatSettingsData>>;
  updateField: <K extends keyof ChatSettingsData>(field: K, value: ChatSettingsData[K]) => void;
  onToggleChat: (checked: boolean) => Promise<void>;
  isUploadingAvatar: boolean;
  avatarFileInputRef: RefObject<HTMLInputElement>;
  onAvatarUpload: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  formsList: Array<{ id: number; slug: string; name: string; isDefault: boolean; isActive: boolean }> | undefined;
  openaiSettings: { enabled: boolean; hasKey: boolean } | undefined;
  geminiSettings: { enabled: boolean; hasKey: boolean } | undefined;
  openRouterSettings: { enabled: boolean; hasKey: boolean } | undefined;
  objectivesSensors: ReturnType<typeof import('@dnd-kit/core').useSensors>;
  onObjectivesDragEnd: (event: DragEndEvent) => void;
  onToggleObjective: (id: IntakeObjective['id'], enabled: boolean) => void;
};

export function ChatSettingsSheet({
  open,
  onOpenChange,
  settingsDraft,
  onSettingsDraftChange,
  updateField,
  onToggleChat,
  isUploadingAvatar,
  avatarFileInputRef,
  onAvatarUpload,
  formsList,
  openaiSettings,
  geminiSettings,
  openRouterSettings,
  objectivesSensors,
  onObjectivesDragEnd,
  onToggleObjective,
}: ChatSettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="w-4 h-4" />
          Settings
        </Button>
      </SheetTrigger>
       <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
         <SheetHeader>
           <SheetTitle>Chat Settings</SheetTitle>
           <SheetDescription>Configure your AI assistant and widget.</SheetDescription>
         </SheetHeader>

         <div className="mt-6 space-y-6 pb-10">
            {/* General Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">General</h3>

              <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Chat Widget</Label>
                  <p className="text-xs text-muted-foreground">Show the chat bubble on your website</p>
                </div>
                <Switch
                  checked={settingsDraft.enabled}
                  onCheckedChange={onToggleChat}
                />
              </div>

              <div className="grid gap-2">
                <Label>Agent Name</Label>
                <Input
                  value={settingsDraft.agentName || ''}
                  onChange={(e) => updateField('agentName', e.target.value)}
                  placeholder="e.g. Sarah"
                />
              </div>

              <div className="grid gap-2">
                <Label>Avatar</Label>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full overflow-hidden border bg-muted flex items-center justify-center relative group">
                     {settingsDraft.agentAvatarUrl ? (
                       <img src={settingsDraft.agentAvatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                     ) : (
                       <User className="h-6 w-6 text-muted-foreground" />
                     )}
                     {isUploadingAvatar && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-white" /></div>}
                  </div>
                  <div className="flex-1">
                     <Input
                       ref={avatarFileInputRef}
                       type="file"
                       accept="image/*"
                       onChange={onAvatarUpload}
                       className="text-xs"
                     />
                     <p className="text-[10px] text-muted-foreground mt-1">Recommended: 100x100px PNG or JPG</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Welcome Message</Label>
                <Textarea
                  value={settingsDraft.welcomeMessage || ''}
                  onChange={(e) => updateField('welcomeMessage', e.target.value)}
                  placeholder="Hi! How can I help you?"
                  rows={2}
                />
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* AI Configuration */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">AI Configuration</h3>

              <div className="grid gap-2">
                <Label>System Prompt</Label>
                <Textarea
                  value={settingsDraft.systemPrompt || ''}
                  onChange={(e) => updateField('systemPrompt', e.target.value)}
                  placeholder="Define the behavior of your assistant..."
                  className="min-h-[150px] font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Instructions for the AI model on how to behave and qualify leads.
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Active AI Provider</Label>
                <Select
                  value={settingsDraft.activeAiProvider || 'openai'}
                  onValueChange={(val) => updateField('activeAiProvider', val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select AI provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">
                      <div className="flex items-center gap-2">
                        <SiOpenai className="w-4 h-4" />
                        <span>OpenAI (GPT)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gemini">
                      <div className="flex items-center gap-2">
                        <SiGoogle className="w-4 h-4" />
                        <span>Google Gemini</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="openrouter">
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="w-4 h-4" />
                        <span>OpenRouter</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Select which AI will respond to chat messages. Make sure the selected provider is enabled in Integrations.
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Qualification Form</Label>
                <Select
                  value={settingsDraft.formSlug ?? '__default__'}
                  onValueChange={(val) => updateField('formSlug', val === '__default__' ? null : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Use default form" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Use default form</SelectItem>
                    {(formsList || [])
                      .filter((f) => f.isActive)
                      .map((f) => (
                        <SelectItem key={f.id} value={f.slug}>
                          {f.name}{f.isDefault ? ' (default)' : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  The AI assistant will qualify leads with this form. Changes take effect on new conversations.
                </p>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div className="flex items-center gap-2">
                  <SiOpenai className={clsx("w-5 h-5", openaiSettings?.enabled ? "text-green-600" : "text-slate-400")} />
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium">OpenAI Integration</span>
                    <p className="text-xs text-muted-foreground">{openaiSettings?.enabled ? 'Active and connected' : 'Not configured'}</p>
                  </div>
                </div>
                {!openaiSettings?.enabled && (
                   <Button variant="outline" size="sm" asChild>
                     <Link href="/admin/integrations">Configure</Link>
                   </Button>
                )}
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div className="flex items-center gap-2">
                  <SiGoogle className={clsx("w-5 h-5", geminiSettings?.enabled ? "text-green-600" : "text-slate-400")} />
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium">Gemini Integration</span>
                    <p className="text-xs text-muted-foreground">{geminiSettings?.enabled ? 'Active and connected' : 'Not configured'}</p>
                  </div>
                </div>
                {!geminiSettings?.enabled && (
                   <Button variant="outline" size="sm" asChild>
                     <Link href="/admin/integrations">Configure</Link>
                   </Button>
                )}
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div className="flex items-center gap-2">
                  <LayoutGrid className={clsx("w-5 h-5", openRouterSettings?.enabled ? "text-green-600" : "text-slate-400")} />
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium">OpenRouter Integration</span>
                    <p className="text-xs text-muted-foreground">{openRouterSettings?.enabled ? 'Active and connected' : 'Not configured'}</p>
                  </div>
                </div>
                {!openRouterSettings?.enabled && (
                   <Button variant="outline" size="sm" asChild>
                     <Link href="/admin/integrations">Configure</Link>
                   </Button>
                )}
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Lead Qualification */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                 <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Lead Qualification</h3>
                 <Button variant="ghost" size="sm" onClick={() => onSettingsDraftChange(prev => ({ ...prev, intakeObjectives: DEFAULT_CHAT_OBJECTIVES }))}>
                   Reset Defaults
                 </Button>
              </div>

              <div className="space-y-2">
                <DndContext
                  sensors={objectivesSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={onObjectivesDragEnd}
                >
                  <SortableContext
                    items={(settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES).map(o => o.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {(settingsDraft.intakeObjectives || DEFAULT_CHAT_OBJECTIVES).map((objective) => (
                      <ChatSortableObjectiveItem
                        key={objective.id}
                        objective={objective}
                        onToggle={(enabled) => onToggleObjective(objective.id, enabled)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
         </div>
      </SheetContent>
    </Sheet>
  );
}
