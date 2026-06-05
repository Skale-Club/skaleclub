import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { LanguageContext } from '@/context/LanguageContext';
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Plus,
  Rss,
  Tag,
  Zap,
} from 'lucide-react';
import { AdminCard, SectionHeader, SubSidebar, SubSidebarLayout } from './shared';
import { RssAutomationTab } from './blog/RssAutomationTab';
import { BlogAutomationPanel } from './blog/BlogAutomationPanel';
import { BlogTagManagerDialog } from './blog/BlogTagManagerDialog';
import { BlogPostEditorForm, type BlogFormData } from './blog/BlogPostEditorForm';
import { BlogPostsList } from './blog/BlogPostsList';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { usePagePaths } from '@/lib/pagePaths';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import type { BlogPost } from '@shared/schema';
import { SIDEBAR_MENU_ITEMS } from './shared/constants';
import { uploadFileToServer } from './shared/utils';

const BLOG_TABS: { id: 'posts' | 'automation' | 'rss'; label: string; icon: typeof FileText }[] = [
  { id: 'posts', label: 'Posts', icon: FileText },
  { id: 'automation', label: 'Automation', icon: Zap },
  { id: 'rss', label: 'RSS', icon: Rss },
];

function BlogSectionInner({ resetSignal }: { resetSignal: number }) {
  const { toast } = useToast();
  const pagePaths = usePagePaths();
  const [activeTab, setActiveTab] = useState<'posts' | 'automation' | 'rss'>('posts');
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
  const [formData, setFormData] = useState<BlogFormData>({
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
    mutationFn: (data: BlogFormData) => apiRequest('POST', '/api/blog', data),
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
    mutationFn: ({ id, data }: { id: number; data: BlogFormData }) =>
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

  const handleCancelEditor = useCallback(() => {
    setIsCreateOpen(false);
    setEditingPost(null);
    setIsSaved(false);
    resetForm();
  }, [resetForm]);

  if (isLoading && !posts) {
    return (
      <div className="flex w-full items-center justify-center h-64">
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
              onClick={handleCancelEditor}
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
              onClick={() => window.open(pagePaths.blogPost(formData.slug), '_blank')}
              className="border-0"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Post
            </Button>
          )}
        </div>
        <AdminCard className="space-y-6">
          <BlogPostEditorForm
            formData={formData}
            onFormDataChange={setFormData}
            tagInput={tagInput}
            onTagInputChange={setTagInput}
            availableTags={availableTags}
            selectedTagSet={selectedTagSet}
            onAddTag={addTag}
            isEditorExpanded={isEditorExpanded}
            onEditorExpandedChange={setIsEditorExpanded}
            contentRef={contentRef}
            onSyncEditorContent={syncEditorContent}
            onRunEditorCommand={runEditorCommand}
            onSetEditorBlock={setEditorBlock}
            onInsertEditorLink={insertEditorLink}
            onTitleChange={handleTitleChange}
            onImageUpload={handleImageUpload}
            onSubmit={handleSubmit}
            isPending={createMutation.isPending || updateMutation.isPending}
            isSaved={isSaved}
            isEditing={!!editingPost}
            onCancel={handleCancelEditor}
          />
        </AdminCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Blog"
        description="Articles, drafts and SEO-optimized content"
        icon={<FileText className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-2">
            <Dialog open={isTagManagerOpen} onOpenChange={setIsTagManagerOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Tag className="w-4 h-4 mr-2" />
                  Manage Tags
                </Button>
              </DialogTrigger>
              <BlogTagManagerDialog
                open={isTagManagerOpen}
                onOpenChange={setIsTagManagerOpen}
                availableTags={availableTags}
                editingTag={editingTag}
                editingTagValue={editingTagValue}
                isDeletingTag={isDeletingTag}
                isRenamingTag={isRenamingTag}
                onEditingTagValueChange={setEditingTagValue}
                onStartEdit={handleStartEditTag}
                onSubmitEdit={handleSubmitEditTag}
                onCancelEdit={handleCancelEditTag}
                onRequestDelete={setTagToDelete}
              />
            </Dialog>
            <Select value={sortBy} onValueChange={(value: typeof sortBy) => setSortBy(value)}>
              <SelectTrigger className="w-[160px] h-9" data-testid="select-blog-sort">
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
            <Button size="sm" onClick={() => setIsCreateOpen(true)} data-testid="button-blog-create">
              <Plus className="w-4 h-4 mr-2" />
              New Post
            </Button>
          </div>
        }
      />

      <SubSidebarLayout
        nav={
          <SubSidebar
            items={BLOG_TABS}
            value={activeTab}
            onValueChange={(id) => setActiveTab(id as 'posts' | 'automation' | 'rss')}
            storageKey="blog"
          />
        }
      >
        {activeTab === 'posts' && (
          <BlogPostsList
            posts={sortedPosts}
            onEdit={handleEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
            onCreateFirst={() => setIsCreateOpen(true)}
            tagToDelete={tagToDelete}
            isDeletingTag={isDeletingTag}
            onCancelDeleteTag={() => setTagToDelete(null)}
            onConfirmDeleteTag={handleConfirmRemoveTag}
          />
        )}
        {activeTab === 'automation' && <BlogAutomationPanel />}
        {activeTab === 'rss' && <RssAutomationTab />}
      </SubSidebarLayout>
    </div>
  );
}

// The admin UI is English. The app-wide LanguageContext defaults to Portuguese
// (for the public site), which otherwise routes this section's t() strings
// through the PT dictionary. Force English for the Blog subtree so its chrome
// stays consistent with the rest of the admin.
export function BlogSection(props: { resetSignal: number }) {
  const parent = useContext(LanguageContext);
  return (
    <LanguageContext.Provider value={{ language: 'en', setLanguage: parent?.setLanguage ?? (() => {}) }}>
      <BlogSectionInner {...props} />
    </LanguageContext.Provider>
  );
}
