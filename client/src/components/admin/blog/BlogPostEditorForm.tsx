import type React from 'react';
import { ArrowLeft, Calendar, Check, Image, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from '@/components/ui/loader';
import { clsx } from 'clsx';
import { format } from 'date-fns';

export type BlogFormData = {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  metaDescription: string;
  focusKeyword: string;
  tags: string;
  featureImageUrl: string;
  status: string;
  authorName: string;
  publishedAt: string | null;
};

type BlogPostEditorFormProps = {
  formData: BlogFormData;
  onFormDataChange: React.Dispatch<React.SetStateAction<BlogFormData>>;
  tagInput: string;
  onTagInputChange: (v: string) => void;
  availableTags: string[];
  selectedTagSet: Set<string>;
  onAddTag: (tag: string) => void;
  isEditorExpanded: boolean;
  onEditorExpandedChange: (v: boolean) => void;
  contentRef: React.RefObject<HTMLDivElement>;
  onSyncEditorContent: () => void;
  onRunEditorCommand: (command: string, value?: string) => void;
  onSetEditorBlock: (tag: 'p' | 'h2') => void;
  onInsertEditorLink: () => void;
  onTitleChange: (value: string) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  isSaved: boolean;
  isEditing: boolean;
  onCancel: () => void;
};

export function BlogPostEditorForm({
  formData,
  onFormDataChange,
  tagInput,
  onTagInputChange,
  availableTags,
  selectedTagSet,
  onAddTag,
  isEditorExpanded,
  onEditorExpandedChange,
  contentRef,
  onSyncEditorContent,
  onRunEditorCommand,
  onSetEditorBlock,
  onInsertEditorLink,
  onTitleChange,
  onImageUpload,
  onSubmit,
  isPending,
  isSaved,
  isEditing,
  onCancel,
}: BlogPostEditorFormProps): JSX.Element {
  const publishedDate = formData.publishedAt
    ? new Date(`${formData.publishedAt}T00:00:00`)
    : undefined;

  const focusScore = (() => {
    const keyword = formData.focusKeyword.toLowerCase().trim();
    if (!keyword) return null;

    const title = formData.title.toLowerCase();
    const slug = formData.slug.toLowerCase();
    const content = formData.content.toLowerCase();
    const metaDesc = formData.metaDescription.toLowerCase();

    let score = 0;
    if (title.includes(keyword)) score += 25;
    if (slug.includes(keyword.replace(/\s+/g, '-'))) score += 15;
    if (metaDesc.includes(keyword)) score += 25;

    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    const keywordRegex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const keywordCount = (content.match(keywordRegex) || []).length;
    const density = wordCount > 0 ? (keywordCount / wordCount) * 100 : 0;

    if (keywordCount >= 1) score += 10;
    if (keywordCount >= 3) score += 10;
    if (density >= 0.5 && density <= 2.5) score += 15;

    const barColor = score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-red-500';
    const badgeClass = score >= 80
      ? 'bg-green-500/15 text-green-600 dark:text-green-400'
      : score >= 50
      ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
      : 'bg-red-500/15 text-red-600 dark:text-red-400';

    return { score, barColor, badgeClass };
  })();

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Enter post title"
            className="border-0 bg-background"
            required
            data-testid="input-blog-title"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            value={formData.slug}
            onChange={(e) => onFormDataChange(prev => ({ ...prev, slug: e.target.value }))}
            placeholder="url-friendly-slug"
            className="border-0 bg-background"
            required
            data-testid="input-blog-slug"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="focusKeyword">Focus Keyword</Label>
          <div className="rounded-md bg-background overflow-hidden">
            <div className="relative">
              <Input
                id="focusKeyword"
                value={formData.focusKeyword}
                onChange={(e) => onFormDataChange(prev => ({ ...prev, focusKeyword: e.target.value }))}
                placeholder="Primary SEO keyword"
                className="pr-14 rounded-none border-0 bg-transparent"
                data-testid="input-blog-keyword"
              />
              {focusScore && (
                <span
                  className={clsx(
                    "absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    focusScore.badgeClass
                  )}
                >
                  {focusScore.score}/100
                </span>
              )}
            </div>
            {focusScore && (
              <div className="h-[3px] bg-slate-200 dark:bg-slate-700">
                <div className={clsx("h-full transition-all", focusScore.barColor)} style={{ width: `${focusScore.score}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Content *</Label>
        <div className="rounded-md bg-background overflow-hidden">
          <div className="flex flex-wrap items-center gap-1 border-b border-border/50 px-2 py-2 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => onSetEditorBlock('p')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              P
            </button>
            <button
              type="button"
              onClick={() => onSetEditorBlock('h2')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              H2
            </button>
            <span className="mx-1 h-4 w-px bg-border/60" />
            <button
              type="button"
              onClick={() => onRunEditorCommand('bold')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => onRunEditorCommand('italic')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => onRunEditorCommand('insertUnorderedList')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              UL
            </button>
            <button
              type="button"
              onClick={() => onRunEditorCommand('insertOrderedList')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              OL
            </button>
            <button
              type="button"
              onClick={onInsertEditorLink}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              Link
            </button>
            <button
              type="button"
              onClick={() => onRunEditorCommand('removeFormat')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => onEditorExpandedChange(!isEditorExpanded)}
              className="ml-auto rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              {isEditorExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
          <div
            id="content"
            ref={contentRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck
            onInput={onSyncEditorContent}
            onBlur={onSyncEditorContent}
            data-placeholder="Write your blog post content here..."
            className={clsx(
              "admin-editor px-3 py-2 text-sm focus:outline-none prose prose-sm dark:prose-invert max-w-none overflow-y-auto",
              isEditorExpanded
                ? "min-h-[320px] max-h-[65vh] sm:min-h-[420px] sm:max-h-[70vh]"
                : "min-h-[180px] max-h-[40vh] sm:min-h-[220px] sm:max-h-[45vh]"
            )}
            data-testid="textarea-blog-content"
          />
        </div>
        <p className="text-xs text-muted-foreground">Supports HTML formatting</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="metaDescription">Meta Description</Label>
          <Textarea
            id="metaDescription"
            value={formData.metaDescription}
            onChange={(e) => onFormDataChange(prev => ({
              ...prev,
              metaDescription: e.target.value.slice(0, 155)
            }))}
            placeholder="Short description for SEO and blog cards..."
            className="min-h-[100px] border-0 bg-background"
            data-testid="textarea-blog-meta"
          />
          <p className="text-xs text-muted-foreground">{formData.metaDescription.length}/155 characters ? Used for SEO and blog cards</p>
        </div>
        <div className="space-y-2">
          <Label>Feature Image</Label>
          <div
            className="relative w-full sm:w-1/2 aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden group"
            onClick={() => document.getElementById('featureImageInput')?.click()}
          >
            {formData.featureImageUrl ? (
              <>
                <img
                  src={formData.featureImageUrl}
                  alt="Feature"
                  className="w-full h-full object-cover"
                  data-testid="img-blog-feature-preview"
                />
                <div className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                  Uploaded
                </div>
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-sm font-medium">Click to change</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFormDataChange(prev => ({ ...prev, featureImageUrl: '' }));
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                <Image className="w-8 h-8 mb-2" />
                <span className="text-sm">Click to upload</span>
                <span className="text-xs mt-1">1200x675px (16:9)</span>
              </div>
            )}
            <input
              id="featureImageInput"
              type="file"
              accept="image/*"
              onChange={onImageUpload}
              className="hidden"
              data-testid="input-blog-feature-image"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-1">
        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2 min-h-9 rounded-md bg-background px-3 py-2">
            {formData.tags.split(',').filter(t => t.trim()).map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary"
              >
                {tag.trim()}
                <button
                  type="button"
                  onClick={() => {
                    const tags = formData.tags.split(',').filter(t => t.trim());
                    tags.splice(index, 1);
                    onFormDataChange(prev => ({ ...prev, tags: tags.join(',') }));
                  }}
                  className="hover:text-destructive"
                >
                  ?
                </button>
              </span>
            ))}
            <input
              type="text"
              value={tagInput}
              onChange={(e) => onTagInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  const newTag = tagInput.trim();
                  if (newTag && !formData.tags.split(',').map(t => t.trim().toLowerCase()).includes(newTag.toLowerCase())) {
                    onFormDataChange(prev => ({
                      ...prev,
                      tags: prev.tags ? `${prev.tags},${newTag}` : newTag
                    }));
                  }
                  onTagInputChange('');
                }
              }}
              placeholder={formData.tags ? "Add more..." : "Type and press Enter..."}
              className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
            />
          </div>
          <p className="text-xs text-muted-foreground">Press Enter or comma to add a tag</p>
          {availableTags.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Available tags</p>
              <div className="flex flex-wrap gap-2">
                {availableTags
                  .filter((tag) => !selectedTagSet.has(tag.toLowerCase()))
                  .map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onAddTag(tag)}
                      className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    >
                      + {tag}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => onFormDataChange(prev => ({ ...prev, status: value }))}
          >
            <SelectTrigger className="border-0 bg-background" data-testid="select-blog-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="publishedAt">Publication Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                id="publishedAt"
                type="button"
                className={clsx(
                  "flex h-9 w-full items-center justify-between rounded-md bg-background px-3 py-2 text-sm",
                  !publishedDate && "text-muted-foreground"
                )}
                data-testid="input-blog-date"
              >
                <span className="truncate">
                  {publishedDate ? format(publishedDate, "MM/dd/yyyy") : "Select date"}
                </span>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto rounded-2xl border-0 p-0 shadow-lg overflow-hidden"
              align="end"
              side="bottom"
              sideOffset={8}
            >
              <CalendarPicker
                mode="single"
                selected={publishedDate}
                onSelect={(date) =>
                  onFormDataChange(prev => ({
                    ...prev,
                    publishedAt: date ? format(date, "yyyy-MM-dd") : null
                  }))
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label htmlFor="authorName">Author</Label>
          <Input
            id="authorName"
            value={formData.authorName}
            onChange={(e) => onFormDataChange(prev => ({ ...prev, authorName: e.target.value }))}
            placeholder="Skale Club"
            className="border-0 bg-background"
            data-testid="input-blog-author"
          />
        </div>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-border/70">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          data-testid="button-blog-back-bottom"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Posts
        </Button>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-blog-cancel"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className={isSaved ? 'bg-green-600 hover:bg-green-600' : ''}
            data-testid="button-blog-save"
          >
            {isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            {isSaved && <Check className="w-4 h-4 mr-2" />}
            {isSaved ? 'Saved' : isEditing ? 'Update Post' : 'Create Post'}
          </Button>
        </div>
      </div>
    </form>
  );
}
