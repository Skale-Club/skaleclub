import { MessageSquare, RotateCcw, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from '@/components/ui/loader';
import { EmptyState } from '../shared';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import type { ConversationSummary } from '../shared/types';

export type ChatConversationsListPanelProps = {
  conversations: ConversationSummary[] | undefined;
  visibleConversations: ConversationSummary[];
  loadingConversations: boolean;
  selectedConversation: ConversationSummary | null;
  searchTerm: string;
  statusFilter: 'open' | 'closed' | 'all';
  onSearchChange: (v: string) => void;
  onStatusFilterChange: (s: 'open' | 'closed' | 'all') => void;
  onSelect: (conv: ConversationSummary) => void;
  onRefresh: () => void;
};

export function ChatConversationsListPanel({
  conversations,
  visibleConversations,
  loadingConversations,
  selectedConversation,
  searchTerm,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  onSelect,
  onRefresh,
}: ChatConversationsListPanelProps) {
  const openConversations = conversations?.filter((conv) => conv.status === 'open').length || 0;
  const closedConversations = conversations?.filter((conv) => conv.status === 'closed').length || 0;

  return (
    <Card className="w-80 md:w-96 flex flex-col rounded-2xl shadow-none shrink-0 overflow-hidden">
      <div className="p-3 border-b border-border/50 space-y-3">
         <div className="flex items-center gap-2">
            <div className="relative flex-1">
               <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
               <Input
                 placeholder="Search..."
                 className="pl-9 h-9 bg-background"
                 value={searchTerm}
                 onChange={(e) => onSearchChange(e.target.value)}
               />
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onRefresh}>
               <RotateCcw className={clsx("w-4 h-4", loadingConversations && "animate-spin")} />
            </Button>
         </div>

         <div className="flex gap-1 bg-muted p-1 rounded-md">
            <button
              onClick={() => onStatusFilterChange('open')}
              className={clsx("flex-1 text-xs font-medium py-1.5 rounded-sm transition-all", statusFilter === 'open' ? "bg-white dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Open ({openConversations})
            </button>
            <button
              onClick={() => onStatusFilterChange('closed')}
              className={clsx("flex-1 text-xs font-medium py-1.5 rounded-sm transition-all", statusFilter === 'closed' ? "bg-white dark:bg-slate-800 shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              Archived ({closedConversations})
            </button>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
         {loadingConversations ? (
            <div className="flex w-full justify-center py-8">
               <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
         ) : visibleConversations.length === 0 ? (
            <EmptyState
              icon={<MessageSquare />}
              title="No conversations"
              description="Conversations started from the chat widget will appear here"
              className="p-8"
            />
         ) : (
            visibleConversations.map(conv => (
               <div
                  key={conv.id}
                  onClick={() => onSelect(conv)}
                  className={clsx(
                    "p-3 rounded-lg cursor-pointer transition-colors border",
                    selectedConversation?.id === conv.id
                      ? "bg-white dark:bg-slate-800 border-primary/20 shadow-sm ring-1 ring-primary/20"
                      : "bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-slate-800/50"
                  )}
               >
                  <div className="flex justify-between items-start mb-1">
                     <span className={clsx("font-semibold text-sm", selectedConversation?.id === conv.id ? "text-primary" : "text-foreground")}>
                        {conv.visitorName || 'Guest'}
                     </span>
                     <span className="text-[10px] text-muted-foreground">
                        {conv.lastMessageAt ? format(new Date(conv.lastMessageAt), 'MMM d, HH:mm') : ''}
                     </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                     {conv.lastMessage || 'No messages'}
                  </p>
               </div>
            ))
         )}
      </div>
    </Card>
  );
}
