import { useEffect, useRef } from 'react';
import { Archive, MessageSquare, RotateCcw, Send, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from '@/components/ui/loader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ChatBubble } from './ChatBubble';
import type { ConversationMessage, ConversationSummary } from '../shared/types';

export type ChatConversationPanelProps = {
  selectedConversation: ConversationSummary | null;
  messages: ConversationMessage[];
  isMessagesLoading: boolean;
  assistantAvatar: string;
  onToggleStatus: () => void;
  onDelete: () => void;
  newMessage: string;
  onNewMessageChange: (v: string) => void;
  onSend: () => void;
};

export function ChatConversationPanel({
  selectedConversation,
  messages,
  isMessagesLoading,
  assistantAvatar,
  onToggleStatus,
  onDelete,
  newMessage,
  onNewMessageChange,
  onSend,
}: ChatConversationPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0 && !isMessagesLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, isMessagesLoading]);

  return (
    <Card className="flex-1 flex flex-col rounded-2xl shadow-none overflow-hidden">
      {selectedConversation ? (
         <>
           {/* Chat Header */}
           <div className="h-16 border-b border-border/50 flex items-center justify-between px-6 bg-muted/30 shrink-0">
              <div className="flex items-center gap-3">
                 <div className="h-9 w-9 rounded-full bg-muted text-foreground flex items-center justify-center font-bold text-sm">
                    {(selectedConversation.visitorName?.[0] || 'G').toUpperCase()}
                 </div>
                 <div>
                    <h3 className="font-semibold text-sm">{selectedConversation.visitorName || 'Guest'}</h3>
                    <p className="text-xs text-muted-foreground">{selectedConversation.visitorEmail || selectedConversation.visitorPhone || 'No contact info'}</p>
                 </div>
              </div>
              <div className="flex items-center gap-1">
                 <Button
                   variant="ghost"
                   size="icon"
                   onClick={onToggleStatus}
                   title={selectedConversation.status === 'open' ? "Archive" : "Reopen"}
                 >
                    {selectedConversation.status === 'open' ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                 </Button>

                 <AlertDialog>
                   <AlertDialogTrigger asChild>
                     <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                     </Button>
                   </AlertDialogTrigger>
                   <AlertDialogContent>
                     <AlertDialogHeader>
                       <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                       <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                     </AlertDialogHeader>
                     <AlertDialogFooter>
                       <AlertDialogCancel>Cancel</AlertDialogCancel>
                       <AlertDialogAction onClick={onDelete} className="bg-destructive">Delete</AlertDialogAction>
                     </AlertDialogFooter>
                   </AlertDialogContent>
                 </AlertDialog>
              </div>
           </div>

           {/* Messages Area */}
           <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-muted/20">
              {isMessagesLoading ? (
                 <div className="flex w-full justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                 </div>
              ) : messages.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                    <MessageSquare className="w-10 h-10 mb-2" />
                    <p>No messages yet</p>
                 </div>
              ) : (
                 messages.map(msg => (
                    <ChatBubble
                       key={msg.id}
                       message={msg}
                       assistantAvatar={assistantAvatar}
                    />
                 ))
              )}
              <div ref={messagesEndRef} />
           </div>

           {/* Input Area */}
           <div className="p-4 bg-background border-t border-border/50 shrink-0">
              <div className="relative">
                 <Textarea
                   value={newMessage}
                   onChange={(e) => onNewMessageChange(e.target.value)}
                   placeholder="Type your message..."
                   className="min-h-[60px] resize-none pr-12"
                   onKeyDown={(e) => {
                     if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       onSend();
                     }
                   }}
                 />
                 <Button
                   size="icon"
                   className="absolute right-2 bottom-2 h-8 w-8"
                   onClick={onSend}
                   disabled={!newMessage.trim()}
                 >
                   <Send className="w-4 h-4" />
                 </Button>
              </div>
           </div>
         </>
      ) : (
         <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
           <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
           <p>Select a conversation to start chatting</p>
         </div>
      )}
    </Card>
  );
}
