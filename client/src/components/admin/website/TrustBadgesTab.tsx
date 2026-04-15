import { useState } from 'react';
import { BadgeCheck, Clock, Heart, Image, Loader2, Plus, Shield, Sparkles, Star, ThumbsUp, Trash2, Trophy } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { HomepageContent } from '@shared/schema';
import { uploadFileToServer } from '../shared/utils';

const badgeIconOptions = [
  { label: 'Star', value: 'star', icon: Star },
  { label: 'Shield', value: 'shield', icon: Shield },
  { label: 'Clock', value: 'clock', icon: Clock },
  { label: 'Sparkles', value: 'sparkles', icon: Sparkles },
  { label: 'Heart', value: 'heart', icon: Heart },
  { label: 'Badge Check', value: 'badgeCheck', icon: BadgeCheck },
  { label: 'Thumbs Up', value: 'thumbsUp', icon: ThumbsUp },
  { label: 'Trophy', value: 'trophy', icon: Trophy },
];

interface TrustBadgesTabProps {
  homepageContent: HomepageContent;
  updateHomepageContent: (updater: (prev: HomepageContent) => HomepageContent, fieldKey?: string) => void;
  triggerAutoSave: (updates: Record<string, unknown>, fieldKeys?: string[]) => void;
  SavedIndicator: React.FC<{ field: string }>;
}

export function TrustBadgesTab({ homepageContent, updateHomepageContent, triggerAutoSave, SavedIndicator }: TrustBadgesTabProps) {
  const { toast } = useToast();
  const [isUploadingBadgeImage, setIsUploadingBadgeImage] = useState(false);
  const trustBadges = homepageContent.trustBadges || [];

  return (
    <div className="space-y-6">
      {/* Hero Badge */}
      <div className="rounded-2xl border bg-card p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BadgeCheck className="w-5 h-5 text-primary" />
            Hero Badge
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Trust badge displayed on the hero section.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
          <div className="space-y-2">
            <Label>Badge Image</Label>
            <div className="aspect-square w-full rounded-lg border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden relative group">
              {isUploadingBadgeImage && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 z-10">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                  <p className="text-xs text-white font-medium">Uploading...</p>
                </div>
              )}
              {homepageContent.heroBadgeImageUrl ? (
                <img src={homepageContent.heroBadgeImageUrl} alt="Badge preview" className="w-full h-full object-contain p-3" />
              ) : (
                <div className="text-center p-4">
                  <BadgeCheck className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Click to upload</p>
                </div>
              )}
              <label className={`absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer ${isUploadingBadgeImage ? 'pointer-events-none' : ''}`}>
                <input
                  type="file" className="hidden" accept="image/*" disabled={isUploadingBadgeImage}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsUploadingBadgeImage(true);
                    try {
                      const imagePath = await uploadFileToServer(file);
                      updateHomepageContent(prev => ({ ...prev, heroBadgeImageUrl: imagePath }), 'homepageContent.heroBadgeImageUrl');
                      triggerAutoSave({ homepageContent: { ...(homepageContent || {}), heroBadgeImageUrl: imagePath } }, ['homepageContent.heroBadgeImageUrl']);
                      toast({ title: 'Success!', description: 'Badge image uploaded', duration: 3000 });
                    } catch (error: any) {
                      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
                    } finally {
                      setIsUploadingBadgeImage(false);
                      if (e.target) e.target.value = '';
                    }
                  }}
                />
                <Plus className="w-6 h-6 text-white" />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Alt Text</Label>
              <div className="relative">
                <Input
                  value={homepageContent.heroBadgeAlt || ''}
                  onChange={(e) => updateHomepageContent(prev => ({ ...prev, heroBadgeAlt: e.target.value }), 'homepageContent.heroBadgeAlt')}
                  placeholder="Trusted Experts"
                />
                <SavedIndicator field="homepageContent.heroBadgeAlt" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <Select
                value={homepageContent.trustBadges?.[0]?.icon || 'star'}
                onValueChange={(value) => {
                  updateHomepageContent(prev => {
                    const badges = [...(prev.trustBadges || [])];
                    badges[0] = { ...(badges[0] || {}), icon: value };
                    return { ...prev, trustBadges: badges };
                  }, 'homepageContent.trustBadges.0.icon');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {badgeIconOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="w-4 h-4" />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="rounded-2xl border bg-card p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-primary" />
              Trust Badges
            </h2>
            <p className="text-xs text-muted-foreground mt-1">Badges displayed below the hero section to build trust.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-dashed"
            onClick={() =>
              updateHomepageContent(prev => ({
                ...prev,
                trustBadges: [...(prev.trustBadges || []), { title: 'New Badge', description: '' }],
              }))
            }
          >
            <Plus className="w-4 h-4 mr-2" /> Add badge
          </Button>
        </div>

        <div className="space-y-3">
          {trustBadges.map((badge, index) => (
            <div key={index} className="bg-muted rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-muted-foreground">Badge {index + 1}</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete badge?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the badge "{badge.title}". This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          updateHomepageContent(prev => ({
                            ...prev,
                            trustBadges: (prev.trustBadges || []).filter((_, i) => i !== index),
                          }))
                        }
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_1fr_160px]">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <div className="relative">
                    <Input
                      value={badge.title}
                      onChange={(e) =>
                        updateHomepageContent(prev => {
                          const updatedBadges = [...(prev.trustBadges || [])];
                          updatedBadges[index] = { ...(updatedBadges[index] || { title: '', description: '' }), title: e.target.value };
                          return { ...prev, trustBadges: updatedBadges };
                        }, `homepageContent.trustBadges.${index}.title`)
                      }
                    />
                    <SavedIndicator field={`homepageContent.trustBadges.${index}.title`} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <div className="relative">
                    <Input
                      value={badge.description}
                      onChange={(e) =>
                        updateHomepageContent(prev => {
                          const updatedBadges = [...(prev.trustBadges || [])];
                          updatedBadges[index] = { ...(updatedBadges[index] || { title: '', description: '' }), description: e.target.value };
                          return { ...prev, trustBadges: updatedBadges };
                        }, `homepageContent.trustBadges.${index}.description`)
                      }
                    />
                    <SavedIndicator field={`homepageContent.trustBadges.${index}.description`} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <Select
                    value={badge.icon || badgeIconOptions[index % badgeIconOptions.length].value}
                    onValueChange={(value) =>
                      updateHomepageContent(prev => {
                        const updatedBadges = [...(prev.trustBadges || [])];
                        updatedBadges[index] = { ...(updatedBadges[index] || { title: '', description: '' }), icon: value };
                        return { ...prev, trustBadges: updatedBadges };
                      }, `homepageContent.trustBadges.${index}.icon`)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {badgeIconOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <option.icon className="w-4 h-4" />
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
          {trustBadges.length === 0 && (
            <div className="bg-muted rounded-lg p-8 text-center">
              <BadgeCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No badges added yet. Click "Add badge" to create one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
