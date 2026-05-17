import { FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { AdminCard, EmptyState } from '../shared';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import type { BlogPost } from '@shared/schema';

type BlogPostsListProps = {
  posts: BlogPost[];
  onEdit: (post: BlogPost) => void;
  onDelete: (id: number) => void;
  onCreateFirst: () => void;
  tagToDelete: string | null;
  isDeletingTag: boolean;
  onCancelDeleteTag: () => void;
  onConfirmDeleteTag: () => void;
};

export function BlogPostsList({
  posts,
  onEdit,
  onDelete,
  onCreateFirst,
  tagToDelete,
  isDeletingTag,
  onCancelDeleteTag,
  onConfirmDeleteTag,
}: BlogPostsListProps): JSX.Element {
  return (
    <div className="space-y-6">
      <AdminCard className="space-y-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Posts
        </h2>
        {posts && posts.length > 0 ? (
          <div className="space-y-3">
            {posts.map(post => (
              <div key={post.id} className="flex flex-col gap-4 p-3 sm:p-4 bg-card/90 dark:bg-slate-900/70 rounded-lg sm:flex-row sm:items-start" data-testid={`row-blog-${post.id}`}>
                {post.featureImageUrl ? (
                  <img
                    src={post.featureImageUrl}
                    alt={post.title}
                    className="w-full h-[160px] object-cover rounded-sm cursor-pointer hover:opacity-80 transition-opacity sm:w-[100px] sm:h-[68px] sm:flex-shrink-0"
                    onClick={() => onEdit(post)}
                    data-testid={`img-blog-${post.id}`}
                  />
                ) : (
                  <div
                    className="w-full h-[160px] bg-muted rounded-sm flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors sm:w-[100px] sm:h-[68px] sm:flex-shrink-0"
                    onClick={() => onEdit(post)}
                  >
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-medium truncate cursor-pointer hover:text-primary transition-colors"
                    onClick={() => onEdit(post)}
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
                    onClick={() => onEdit(post)}
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
                          onClick={() => onDelete(post.id)}
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
          <EmptyState
            icon={<FileText />}
            title="No blog posts yet"
            description="Create your first blog post to engage your audience"
            action={
              <Button onClick={onCreateFirst} data-testid="button-blog-first-post">
                <Plus className="w-4 h-4 mr-2" />
                Create First Post
              </Button>
            }
          />
        )}
      </AdminCard>
      <AlertDialog open={!!tagToDelete} onOpenChange={(open) => !open && onCancelDeleteTag()}>
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
            <AlertDialogAction onClick={onConfirmDeleteTag} disabled={isDeletingTag}>
              {isDeletingTag ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
