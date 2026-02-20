import { BadgeCheck, Clock, Heart, Plus, Shield, Sparkles, Star, ThumbsUp, Trash2, Trophy } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { HomepageContent } from '@shared/schema';

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
  SavedIndicator: React.FC<{ field: string }>;
}

export function TrustBadgesTab({ homepageContent, updateHomepageContent, SavedIndicator }: TrustBadgesTabProps) {
  const trustBadges = homepageContent.trustBadges || [];

  return (
    <div className="bg-white dark:bg-card rounded-lg border p-6 space-y-6 transition-all">
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
          <div
            key={index}
            className="bg-muted rounded-lg p-4 space-y-4"
          >
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
  );
}
