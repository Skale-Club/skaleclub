import { MessageSquare } from 'lucide-react';
import { renderMarkdown } from '@/lib/markdown';
import { format } from 'date-fns';
import type { ConversationMessage } from '../shared/types';

export function ChatBubble({ message, assistantAvatar }: { message: ConversationMessage; assistantAvatar?: string }) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={`flex w-full ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div className={`flex max-w-[80%] gap-2 ${isAssistant ? "flex-row" : "flex-row-reverse"}`}>

        {/* Avatar Pequeno (Apenas para o assistente) */}
        {isAssistant && (
          <div className="h-8 w-8 rounded-full bg-muted shrink-0 overflow-hidden mt-1 border flex items-center justify-center">
            {assistantAvatar ? (
              <img src={assistantAvatar} alt="Assistant" className="h-full w-full object-cover" />
            ) : (
              <MessageSquare className="w-4 h-4 text-slate-500" />
            )}
          </div>
        )}

        {/* O Balão de Texto */}
        <div
          className={`p-3 text-sm shadow-sm relative ${
            isAssistant
              ? "bg-card text-card-foreground rounded-tr-xl rounded-br-xl rounded-bl-xl border" // Formato bolha esquerda
              : "bg-primary text-primary-foreground rounded-tl-xl rounded-bl-xl rounded-br-xl" // Formato bolha direita
          }`}
        >
          {/* Conteúdo da Mensagem */}
          <div className="leading-relaxed whitespace-pre-wrap">
            {renderMarkdown(message.content)}
          </div>

          {/* Hora da mensagem */}
          <span className={`text-[10px] block mt-1 ${
            isAssistant ? "text-muted-foreground" : "text-primary-foreground/60"
          }`}>
            {format(new Date(message.createdAt), 'HH:mm')}
          </span>
        </div>
      </div>
    </div>
  );
}
