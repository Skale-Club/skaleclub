import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Check, ExternalLink, FileText, Image, Loader2, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { renderMarkdown } from '@/lib/markdown';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import type { BlogPost } from '@shared/schema';
import { SIDEBAR_MENU_ITEMS } from './shared/constants';
import { uploadFileToServer } from './shared/utils';
export function BlogSection({ resetSignal }: { resetSignal: number }) {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title-asc' | 'title-desc' | 'status'>('newest');
  const [isSaved, setIsSaved] = useState(false);
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [isDeletingTag, setIsDeletingTag] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingTagValue, setEditingTagValue] = useState('');
  const [isRenamingTag, setIsRenamingTag] = useState(false);
  const blogMenuTitle = SIDEBAR_MENU_ITEMS.find((item) => item.id === 'blog')?.title ?? 'Blog Posts';
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    metaDescription: '',
    focusKeyword: '',
    tags: '' as string,
    featureImageUrl: '',
    status: 'published',
    authorName: 'Skale Club',
    publishedAt: new Date().toISOString().split('T')[0] as string | null,
  });
  const [tagInput, setTagInput] = useState('');
  const contentRef = useRef<HTMLDivElement | null>(null);
  const lastContentRef = useRef('');
  const lastResetSignalRef = useRef(0);

  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ['/api/blog'],
  });

  const sortedPosts = useMemo(() => {
    if (!posts) return [];

    const sorted = [...posts];

    switch (sortBy) {
      case 'newest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.publishedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.publishedAt || b.createdAt || 0).getTime();
          return dateB - dateA;
        });
      case 'oldest':
        return sorted.sort((a, b) => {
          const dateA = new Date(a.publishedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.publishedAt || b.createdAt || 0).getTime();
          return dateA - dateB;
        });
      case 'title-asc':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'title-desc':
        return sorted.sort((a, b) => b.title.localeCompare(a.title));
      case 'status':
        return sorted.sort((a, b) => {
          if (a.status === b.status) return 0;
          return a.status === 'published' ? -1 : 1;
        });
      default:
        return sorted;
    }
  }, [posts, sortBy]);

  const availableTags = useMemo(() => {
    if (!posts) return [];
    const tagMap = new Map<string, string>();
    posts.forEach((post) => {
      const rawTags = (post.tags || '').split(',');
      rawTags.forEach((tag) => {
        const trimmed = tag.trim();
        if (!trimmed) return;
        const key = trimmed.toLowerCase();
        if (!tagMap.has(key)) {
          tagMap.set(key, trimmed);
        }
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => a.localeCompare(b));
  }, [posts]);

  const selectedTagSet = useMemo(() => {
    return new Set(
      formData.tags
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    );
  }, [formData.tags]);

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    setFormData((prev) => {
      const existing = prev.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (existing.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      return { ...prev, tags: existing.length ? `${existing.join(',')},${trimmed}` : trimmed };
    });
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      slug: '',
      content: '',
      excerpt: '',
      metaDescription: '',
      focusKeyword: '',
      tags: '',
      featureImageUrl: '',
      status: 'published',
      authorName: 'Skale Club',
      publishedAt: new Date().toISOString().split('T')[0] as string | null,
    });
    setTagInput('');
  }, []);

  // Reset saved state when form data changes
  useEffect(() => {
    if (isSaved) {
      setIsSaved(false);
    }
  }, [formData]);

  useEffect(() => {
    if (resetSignal === lastResetSignalRef.current) return;
    lastResetSignalRef.current = resetSignal;
    if (editingPost || isCreateOpen) {
      setIsCreateOpen(false);
      setEditingPost(null);
      setIsSaved(false);
      resetForm();
    }
  }, [resetSignal, editingPost, isCreateOpen, resetForm]);

  useEffect(() => {
    if (!contentRef.current) return;
    if (formData.content === lastContentRef.current) return;
    if (document.activeElement === contentRef.current) return;
    contentRef.current.innerHTML = formData.content;
    lastContentRef.current = formData.content;
  }, [formData.content]);

  const syncEditorContent = useCallback(() => {
    if (!contentRef.current) return;
    const rawHtml = contentRef.current.innerHTML;
    const text = contentRef.current.textContent?.trim() || '';
    const nextHtml = text ? rawHtml : '';
    lastContentRef.current = nextHtml;
    setFormData(prev => (prev.content === nextHtml ? prev : { ...prev, content: nextHtml }));
  }, []);

  const runEditorCommand = useCallback(
    (command: string, value?: string) => {
      if (!contentRef.current) return;
      contentRef.current.focus();
      document.execCommand(command, false, value);
      syncEditorContent();
    },
    [syncEditorContent]
  );

  const setEditorBlock = useCallback(
    (tag: 'p' | 'h2') => {
      runEditorCommand('formatBlock', `<${tag}>`);
    },
    [runEditorCommand]
  );

  const insertEditorLink = useCallback(() => {
    const url = window.prompt('Enter URL');
    if (!url) return;
    runEditorCommand('createLink', url);
  }, [runEditorCommand]);

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest('POST', '/api/blog', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      toast({ title: 'Blog post created successfully' });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: 'Error creating post', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof formData }) =>
      apiRequest('PUT', `/api/blog/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    },
    onError: (err: any) => {
      toast({ title: 'Error updating post', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/blog/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      toast({ title: 'Blog post deleted' });
    },
    onError: (err: any) => {
      toast({ title: 'Error deleting post', description: err.message, variant: 'destructive' });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: async (tag: string) => {
      await apiRequest('DELETE', `/api/blog/tags/${encodeURIComponent(tag)}`);
    },
    onSuccess: (_data, tag) => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      toast({ title: 'Tag removed', description: `"${tag}" removed from all posts.` });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to remove tag', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      setIsDeletingTag(false);
      setTagToDelete(null);
    }
  });

  const renameTagMutation = useMutation({
    mutationFn: async ({ from, to }: { from: string; to: string }) => {
      await apiRequest('PUT', `/api/blog/tags/${encodeURIComponent(from)}`, { name: to });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
      toast({ title: 'Tag updated', description: `"${variables.from}" renamed to "${variables.to}".` });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to update tag', description: err.message, variant: 'destructive' });
    },
    onSettled: () => {
      setIsRenamingTag(false);
      setEditingTag(null);
      setEditingTagValue('');
    }
  });

  const handleConfirmRemoveTag = useCallback(() => {
    if (!tagToDelete || isDeletingTag) return;
    setIsDeletingTag(true);
    removeTagMutation.mutate(tagToDelete);
  }, [tagToDelete, isDeletingTag, removeTagMutation]);

  const handleStartEditTag = useCallback((tag: string) => {
    if (isRenamingTag) return;
    setEditingTag(tag);
    setEditingTagValue(tag);
  }, [isRenamingTag]);

  const handleCancelEditTag = useCallback(() => {
    setEditingTag(null);
    setEditingTagValue('');
  }, []);

  const handleSubmitEditTag = useCallback(() => {
    if (!editingTag || isRenamingTag) return;
    const next = editingTagValue.trim();
    if (!next) {
      handleCancelEditTag();
      return;
    }
    if (next === editingTag) {
      handleCancelEditTag();
      return;
    }
    const nextLower = next.toLowerCase();
    const currentLower = editingTag.toLowerCase();
    const hasDuplicate = availableTags.some(
      (tag) => tag.toLowerCase() === nextLower && tag.toLowerCase() !== currentLower
    );
    if (hasDuplicate) {
      toast({ title: 'Tag already exists', description: `"${next}" is already in use.` });
      return;
    }
    setIsRenamingTag(true);
    renameTagMutation.mutate({ from: editingTag, to: next });
  }, [editingTag, editingTagValue, isRenamingTag, availableTags, renameTagMutation, toast, handleCancelEditTag]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleTitleChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      title: value,
      slug: prev.slug || generateSlug(value),
    }));
  };

  const handleEdit = async (post: BlogPost) => {
    setEditingPost(post);
    setIsSaved(false);
    setFormData({
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt || '',
      metaDescription: post.metaDescription || '',
      focusKeyword: post.focusKeyword || '',
      tags: (post as any).tags || '',
      featureImageUrl: post.featureImageUrl || '',
      status: post.status,
      authorName: post.authorName || 'Admin',
      publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString().split('T')[0] : null,
    });
    setTagInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim()) {
      toast({ title: 'Content is required', variant: 'destructive' });
      return;
    }
    const dataToSend = {
      ...formData,
      publishedAt: formData.status === 'published' && formData.publishedAt 
        ? new Date(formData.publishedAt).toISOString() 
        : formData.status === 'published' 
          ? new Date().toISOString() 
          : null,
    };

    if (editingPost) {
      updateMutation.mutate({ id: editingPost.id, data: dataToSend });
    } else {
      createMutation.mutate(dataToSend);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imagePath = await uploadFileToServer(file);
      setFormData(prev => ({ ...prev, featureImageUrl: imagePath }));
      toast({ title: 'Image uploaded successfully' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
  };

  const renderForm = () => {
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
      <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => handleTitleChange(e.target.value)}
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
            onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
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
                onChange={(e) => setFormData(prev => ({ ...prev, focusKeyword: e.target.value }))}
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
              onClick={() => setEditorBlock('p')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              P
            </button>
            <button
              type="button"
              onClick={() => setEditorBlock('h2')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              H2
            </button>
            <span className="mx-1 h-4 w-px bg-border/60" />
            <button
              type="button"
              onClick={() => runEditorCommand('bold')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => runEditorCommand('italic')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => runEditorCommand('insertUnorderedList')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              UL
            </button>
            <button
              type="button"
              onClick={() => runEditorCommand('insertOrderedList')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              OL
            </button>
            <button
              type="button"
              onClick={insertEditorLink}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              Link
            </button>
            <button
              type="button"
              onClick={() => runEditorCommand('removeFormat')}
              className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setIsEditorExpanded(prev => !prev)}
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
            onInput={syncEditorContent}
            onBlur={syncEditorContent}
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
            onChange={(e) => setFormData(prev => ({
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
                    setFormData(prev => ({ ...prev, featureImageUrl: '' }));
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
              onChange={handleImageUpload}
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
                    setFormData(prev => ({ ...prev, tags: tags.join(',') }));
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
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  const newTag = tagInput.trim();
                  if (newTag && !formData.tags.split(',').map(t => t.trim().toLowerCase()).includes(newTag.toLowerCase())) {
                    setFormData(prev => ({
                      ...prev,
                      tags: prev.tags ? `${prev.tags},${newTag}` : newTag
                    }));
                  }
                  setTagInput('');
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
                      onClick={() => addTag(tag)}
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
            onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
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
                  setFormData(prev => ({
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
            onChange={(e) => setFormData(prev => ({ ...prev, authorName: e.target.value }))}
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
          onClick={() => {
            setIsCreateOpen(false);
            setEditingPost(null);
            setIsSaved(false);
            resetForm();
          }}
          data-testid="button-blog-back-bottom"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Posts
        </Button>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setIsCreateOpen(false);
              setEditingPost(null);
              setIsSaved(false);
              resetForm();
            }}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-blog-cancel"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
            className={isSaved ? 'bg-green-600 hover:bg-green-600' : ''}
            data-testid="button-blog-save"
          >
            {(createMutation.isPending || updateMutation.isPending) && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            {isSaved && <Check className="w-4 h-4 mr-2" />}
            {isSaved ? 'Saved' : editingPost ? 'Update Post' : 'Create Post'}
          </Button>
        </div>
      </div>
    </form>
    );
  };

  if (isLoading && !posts) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isCreateOpen || editingPost) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsCreateOpen(false);
                setEditingPost(null);
                setIsSaved(false);
                resetForm();
              }}
              data-testid="button-blog-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Posts
            </Button>
            <h1 className="text-2xl font-bold">{editingPost ? 'Edit Post' : 'Create New Post'}</h1>
          </div>
          {editingPost && formData.slug && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/blog/${formData.slug}`, '_blank')}
              className="border-0"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Post
            </Button>
          )}
        </div>
        <div className="bg-muted p-4 sm:p-6 rounded-lg space-y-6 transition-all">
          {renderForm()}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-blog-title">{blogMenuTitle}</h1>
          <p className="text-sm text-muted-foreground">Manage your blog content and SEO</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Dialog open={isTagManagerOpen} onOpenChange={setIsTagManagerOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto border-0">
                <Tag className="w-4 h-4 mr-2" />
                Manage Tags
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md border-0">
              <DialogHeader>
                <DialogTitle>Manage Tags</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {availableTags.length > 0 ? (
                  availableTags.map((tag) => (
                    <div
                      key={tag}
                      className="flex items-center justify-between gap-3 rounded-md bg-muted/60 px-3 py-2"
                      onDoubleClick={() => handleStartEditTag(tag)}
                    >
                      {editingTag === tag ? (
                        <Input
                          value={editingTagValue}
                          onChange={(e) => setEditingTagValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSubmitEditTag();
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              handleCancelEditTag();
                            }
                          }}
                          onBlur={handleSubmitEditTag}
                          autoFocus
                          className="h-8 border-0 bg-transparent px-0 text-sm"
                          data-testid={`input-tag-edit-${tag}`}
                        />
                      ) : (
                        <span className="text-sm font-medium">{tag}</span>
                      )}
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartEditTag(tag)}
                          disabled={isDeletingTag || isRenamingTag}
                          data-testid={`button-tag-edit-${tag}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setTagToDelete(tag)}
                          disabled={isDeletingTag || editingTag === tag || isRenamingTag}
                          data-testid={`button-tag-delete-${tag}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No tags available.</p>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Close</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Select value={sortBy} onValueChange={(value: typeof sortBy) => setSortBy(value)}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-blog-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="title-asc">Title (A-Z)</SelectItem>
              <SelectItem value="title-desc">Title (Z-A)</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
          <Button className="w-full sm:w-auto" onClick={() => setIsCreateOpen(true)} data-testid="button-blog-create">
            <Plus className="w-4 h-4 mr-2" />
            New Post
          </Button>
        </div>
      </div>

      <div className="bg-muted p-4 sm:p-6 rounded-lg space-y-6 transition-all">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Posts
        </h2>
        {sortedPosts && sortedPosts.length > 0 ? (
          <div className="space-y-3">
            {sortedPosts.map(post => (
              <div key={post.id} className="flex flex-col gap-4 p-3 sm:p-4 bg-card/90 dark:bg-slate-900/70 rounded-lg sm:flex-row sm:items-start" data-testid={`row-blog-${post.id}`}>
                {post.featureImageUrl ? (
                  <img
                    src={post.featureImageUrl}
                    alt={post.title}
                    className="w-full h-[160px] object-cover rounded-sm cursor-pointer hover:opacity-80 transition-opacity sm:w-[100px] sm:h-[68px] sm:flex-shrink-0"
                    onClick={() => handleEdit(post)}
                    data-testid={`img-blog-${post.id}`}
                  />
                ) : (
                  <div
                    className="w-full h-[160px] bg-muted rounded-sm flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors sm:w-[100px] sm:h-[68px] sm:flex-shrink-0"
                    onClick={() => handleEdit(post)}
                  >
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-medium truncate cursor-pointer hover:text-primary transition-colors"
                    onClick={() => handleEdit(post)}
                    data-testid={`text-blog-title-${post.id}`}
                  >
                    {post.title}
                  </h3>
                  <div className="flex flex-col items-start gap-1 text-sm text-muted-foreground">
                    <span>{post.publishedAt ? format(new Date(post.publishedAt), 'MMM d, yyyy') : 'Not published'}</span>
                    <Badge variant={post.status === 'published' ? 'default' : 'secondary'} data-testid={`badge-blog-status-${post.id}`}>
                      {post.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(post)}
                    data-testid={`button-blog-edit-${post.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-blog-delete-${post.id}`}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Blog Post?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{post.title}". This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(post.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No blog posts yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first blog post to engage your audience
            </p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-blog-first-post">
              <Plus className="w-4 h-4 mr-2" />
              Create First Post
            </Button>
          </div>
        )}
      </div>
      <AlertDialog open={!!tagToDelete} onOpenChange={(open) => !open && setTagToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove tag</AlertDialogTitle>
            <AlertDialogDescription>
              {tagToDelete
                ? `Remove "${tagToDelete}" from all posts? This cannot be undone.`
                : 'Remove this tag from all posts?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingTag}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRemoveTag} disabled={isDeletingTag}>
              {isDeletingTag ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

