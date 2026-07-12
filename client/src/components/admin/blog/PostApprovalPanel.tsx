import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, ExternalLink, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { AdminCard } from '../shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { usePagePaths } from '@/lib/pagePaths';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from '@/components/ui/loader';
import type { BlogPost, BlogPostFeedback } from '@shared/schema';

const AI_AUTHOR = 'AI Assistant';
const DRAFTS_QUERY_KEY = '/api/blog?status=draft';

function invalidateApprovalQueries() {
  // Element-wise prefix matching: each key must be invalidated explicitly.
  queryClient.invalidateQueries({ queryKey: ['/api/blog'] });
  queryClient.invalidateQueries({ queryKey: [DRAFTS_QUERY_KEY] });
  queryClient.invalidateQueries({ queryKey: ['/api/blog/feedback'] });
}

// Autopost port: pending AI drafts wait here when auto-approve is off.
// Approve = publish + positive signal; Reject = negative signal (+ optional
// reason, the strongest learning input) + delete. Both feed the generator's
// self-improvement loop.
export function PostApprovalPanel() {
  const { toast } = useToast();
  const pagePaths = usePagePaths();
  const [rejectTarget, setRejectTarget] = useState<BlogPost | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: drafts, isLoading } = useQuery<BlogPost[]>({
    queryKey: [DRAFTS_QUERY_KEY],
    staleTime: 30_000,
  });

  const { data: feedback } = useQuery<BlogPostFeedback[]>({
    queryKey: ['/api/blog/feedback'],
    staleTime: 30_000,
  });

  const pendingPosts = (drafts ?? []).filter((post) => post.authorName === AI_AUTHOR);

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/blog/posts/${id}/approve`),
    onSuccess: () => {
      invalidateApprovalQueries();
      toast({ title: 'Post approved and published' });
    },
    onError: (err: any) => {
      toast({ title: 'Error approving post', description: err.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiRequest('POST', `/api/blog/posts/${id}/reject`, { reason: reason || undefined }),
    onSuccess: () => {
      invalidateApprovalQueries();
      setRejectTarget(null);
      setRejectReason('');
      toast({ title: 'Post rejected', description: 'The generator will learn from this decision.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error rejecting post', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <AdminCard>
      <div className="space-y-6 p-6">
        <div>
          <h2 className="text-lg font-semibold">Approval Queue</h2>
          <p className="text-sm text-muted-foreground">
            AI-generated drafts waiting for your decision. Every approve/reject teaches the generator what to write next.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : pendingPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground border rounded-lg px-4 py-6 text-center bg-muted/30">
            No AI drafts waiting for approval.
          </p>
        ) : (
          <ul className="space-y-3">
            {pendingPosts.map((post) => (
              <li
                key={post.id}
                className="flex flex-col gap-3 sm:flex-row sm:items-center border rounded-lg p-3 bg-card"
                data-testid={`approval-row-${post.id}`}
              >
                {post.featureImageUrl ? (
                  <img
                    src={post.featureImageUrl}
                    alt=""
                    className="h-16 w-24 rounded-md object-cover shrink-0"
                  />
                ) : (
                  <div className="h-16 w-24 rounded-md bg-muted shrink-0" />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium text-sm truncate">{post.title}</p>
                  {post.excerpt && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{post.excerpt}</p>
                  )}
                  {post.createdAt && (
                    <p className="text-xs text-muted-foreground">
                      Generated {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(pagePaths.blogPost(post.slug), '_blank')}
                    title="Preview"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={approveMutation.isPending}
                    onClick={() => approveMutation.mutate(post.id)}
                    data-testid={`button-approve-${post.id}`}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={rejectMutation.isPending}
                    onClick={() => { setRejectTarget(post); setRejectReason(''); }}
                    data-testid={`button-reject-${post.id}`}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Feedback history — what the generator has learned so far */}
        {(feedback?.length ?? 0) > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Recent feedback</h3>
            <ul className="space-y-1.5">
              {feedback!.slice(0, 8).map((item) => (
                <li key={item.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                  {item.signal === 'positive' ? (
                    <ThumbsUp className="w-3.5 h-3.5 mt-0.5 text-green-500 shrink-0" />
                  ) : (
                    <ThumbsDown className="w-3.5 h-3.5 mt-0.5 text-red-500 shrink-0" />
                  )}
                  <span className="min-w-0">
                    <span className="text-foreground">{item.postTitle}</span>
                    {item.reason && <span> — {item.reason}</span>}
                    {item.createdAt && (
                      <span className="whitespace-nowrap"> · {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Reject dialog — the reason is the strongest learning signal */}
      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject post</DialogTitle>
            <DialogDescription>
              "{rejectTarget?.title}" will be deleted. Tell the generator why — the reason is fed into future generations so it avoids the same mistakes.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. Too generic, no actionable takeaways. / Wrong audience — this reads B2C."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            maxLength={1000}
            data-testid="textarea-reject-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectMutation.isPending}
              onClick={() => rejectTarget && rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason.trim() })}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reject & delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminCard>
  );
}
