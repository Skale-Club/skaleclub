import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare, Send, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  trackChatOpen,
  trackChatClose,
  trackChatMessageSent,
  trackChatMessageReceived,
  trackChatNewConversation,
  trackChatLeadCaptured,
  trackChatBookingCompleted,
} from "@/lib/analytics";
import { renderMarkdown } from "@/lib/markdown";

type UrlRule = {
  pattern: string;
  match: "contains" | "starts_with" | "equals";
};

type ChatConfig = {
  enabled: boolean;
  agentName: string;
  agentAvatarUrl?: string;
  fallbackAvatarUrl?: string;
  welcomeMessage: string;
  excludedUrlRules: UrlRule[];
};

type ChatMessage = {
  id: string;
  role: "assistant" | "visitor";
  content: string;
  createdAt?: string;
};


const STORAGE_KEY = "chat_conversation_id";
const LOCAL_MESSAGES_KEY = "chat_widget_messages";

function matchesRule(url: string, rule: UrlRule) {
  if (!rule?.pattern) return false;
  if (rule.match === "contains") return url.includes(rule.pattern);
  if (rule.match === "starts_with") return url.startsWith(rule.pattern);
  return url === rule.pattern;
}

function isUrlExcluded(url: string, rules: UrlRule[]) {
  return rules?.some((rule) => matchesRule(url, rule));
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [location, setLocation] = useLocation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | undefined>();
  const [showOnlineDot, setShowOnlineDot] = useState(false);
  const [showWelcomePreview, setShowWelcomePreview] = useState(false);
  const showLauncherAvatarImage = !showWelcomePreview;
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const [shouldShowDotAfterClose, setShouldShowDotAfterClose] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  const { data: config } = useQuery<ChatConfig>({
    queryKey: ["/api/chat/config"],
    queryFn: async () => {
      const res = await fetch("/api/chat/config", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load chat config");
      return res.json();
    },
  });

  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE_KEY);
    const storedMessages = localStorage.getItem(LOCAL_MESSAGES_KEY);
    if (storedId) {
      setConversationId(storedId);
    }
    if (storedMessages) {
      try {
        setMessages(JSON.parse(storedMessages));
      } catch {
        setMessages([]);
      }
    }
  }, []);

  useEffect(() => {
    if (conversationId) {
      localStorage.setItem(STORAGE_KEY, conversationId);
      setLoadingHistory(true);
      fetch(`/api/chat/conversations/${conversationId}/messages`, { credentials: "include" })
        .then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          const mapped = (data.messages || []).map((m: any) => ({
            id: m.id,
            role: m.role === "assistant" ? "assistant" : "visitor",
            content: m.content,
            createdAt: m.createdAt,
          })) as ChatMessage[];

          const merged = [...mapped];
          if (config?.welcomeMessage && !merged.some((m) => m.role === "assistant" && m.content === config.welcomeMessage)) {
            merged.unshift({
              id: makeId(),
              role: "assistant",
              content: config.welcomeMessage,
              createdAt: new Date().toISOString(),
            });
          }

          if (merged.length > 0) {
            setMessages(merged);
            localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(merged));
          }
        })
        .finally(() => setLoadingHistory(false));
    }
  }, [conversationId, config?.welcomeMessage]);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(LOCAL_MESSAGES_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && config?.welcomeMessage && messages.length === 0) {
      setMessages([
        {
          id: makeId(),
          role: "assistant",
          content: config.welcomeMessage,
        },
      ]);
    }
  }, [isOpen, config?.welcomeMessage, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  useEffect(() => {
    if (!config) return;
    setAvatarSrc(config.agentAvatarUrl || config.fallbackAvatarUrl || "/favicon.ico");
  }, [config]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const alreadySeen = sessionStorage.getItem("chat_welcome_shown") === "1";
    setHasShownWelcome(alreadySeen);
  }, []);

  useEffect(() => {
    if (!config?.enabled || isOpen || hasShownWelcome) {
      return;
    }
    const dotTimer = setTimeout(() => setShowOnlineDot(true), 500);
    const bubbleTimer = setTimeout(() => {
      setShowWelcomePreview(true);
      setHasShownWelcome(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("chat_welcome_shown", "1");
      }
    }, 5000);
    return () => {
      clearTimeout(dotTimer);
      clearTimeout(bubbleTimer);
    };
  }, [config?.enabled, isOpen, hasShownWelcome]);

  useEffect(() => {
    if (isOpen) {
      setShowOnlineDot(false);
      setShowWelcomePreview(false);
    } else if (shouldShowDotAfterClose) {
      setShowOnlineDot(true);
    }
  }, [isOpen, shouldShowDotAfterClose]);

  useEffect(() => {
    if (hasShownWelcome) {
      setShouldShowDotAfterClose(true);
    }
  }, [hasShownWelcome]);

  const excluded = useMemo(() => {
    const url = typeof window !== "undefined" ? window.location.pathname : location;
    return config ? isUrlExcluded(url, config.excludedUrlRules || []) : false;
  }, [config, location]);

  if (!config?.enabled || excluded) {
    return null;
  }

  const displayName = config.agentName || "Assistant";
  const avatarUrl = avatarSrc || config?.agentAvatarUrl || config?.fallbackAvatarUrl || "/favicon.ico";
  const headerIcon = config?.fallbackAvatarUrl || "/favicon.ico";

  const handleAvatarError = () => {
    if (config?.fallbackAvatarUrl && avatarSrc !== config.fallbackAvatarUrl) {
      setAvatarSrc(config.fallbackAvatarUrl);
    } else {
      setAvatarSrc("/favicon.ico");
    }
  };

  const startNewConversation = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LOCAL_MESSAGES_KEY);
    setConversationId(null);
    setMessages([]);
    setLimitReached(false);
    trackChatNewConversation(window.location.pathname);
    if (config?.welcomeMessage) {
      setMessages([{ id: makeId(), role: "assistant", content: config.welcomeMessage }]);
    }
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || isSending || limitReached) return;

    const visitorMessage: ChatMessage = {
      id: makeId(),
      role: "visitor",
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, visitorMessage]);
    setInput("");
    setIsSending(true);
    trackChatMessageSent(window.location.pathname, conversationId || undefined);

    try {
      const payload = {
        conversationId: conversationId || undefined,
        message: content,
        pageUrl: window.location.pathname,
        userAgent: navigator.userAgent,
      };
      const res = await apiRequest("POST", "/api/chat/message", payload);
      const data = await res.json();

      if (data.limitReached) {
        setLimitReached(true);
        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: "assistant", content: data.message },
        ]);
        return;
      }

      if (data.conversationId && data.conversationId !== conversationId) {
        setConversationId(data.conversationId);
      }
      const assistantMessage: ChatMessage = {
        id: makeId(),
        role: "assistant",
        content: data.response || "Thanks for reaching out!",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      trackChatMessageReceived(window.location.pathname, data.conversationId || conversationId || undefined);

      // Track lead capture event
      if (data.leadCaptured) {
        trackChatLeadCaptured(window.location.pathname, data.conversationId || conversationId || undefined);
      }

      // Track booking completion (conversion)
      if (data.bookingCompleted) {
        trackChatBookingCompleted(
          window.location.pathname,
          data.conversationId || conversationId || undefined,
          data.bookingCompleted.value,
          data.bookingCompleted.services
        );
      }
    } catch (error: any) {
      const errorData = error?.data || {};
      if (errorData.limitReached) {
        setLimitReached(true);
      }
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: "assistant", content: error.message || "Chat is unavailable right now." },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const toggleOpen = () => {
    setIsOpen((prev) => {
      const willOpen = !prev;
      if (willOpen) {
        trackChatOpen(window.location.pathname);
      } else {
        trackChatClose(window.location.pathname, messages.length);
      }
      return willOpen;
    });
  };

  const renderLauncher = () => {
    if (isOpen) return null;

    if (showWelcomePreview && config?.welcomeMessage) {
      return (
        <button
          type="button"
          onClick={toggleOpen}
          className="mb-2 mr-2 flex items-end justify-end gap-2 animate-in fade-in slide-in-from-bottom-1"
        >
          <div className="relative bg-white shadow-lg border rounded-2xl px-4 py-3 text-sm max-w-[240px] text-left">
            <p className="leading-snug">{config.welcomeMessage}</p>
            <div className="absolute -right-2 top-4 h-3 w-3 rotate-45 bg-white border-b border-r border-slate-200" />
          </div>
          <div className="relative">
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-14 w-14 rounded-full border border-slate-200 object-cover"
              onError={handleAvatarError}
            />
            {showOnlineDot && (
              <span className="absolute bottom-0 right-0 translate-x-[2px] translate-y-[2px] h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-white shadow-sm" />
            )}
          </div>
        </button>
      );
    }

    return (
      <Button
        className="rounded-full shadow-lg bg-primary text-white hover:bg-primary/90 h-14 w-14 p-0 relative"
        onClick={toggleOpen}
        data-testid="button-open-chat"
        aria-label="Open chat"
        onMouseEnter={() => setShowOnlineDot(true)}
      >
        {showLauncherAvatarImage && avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-14 w-14 rounded-full object-cover"
            onError={handleAvatarError}
          />
        ) : (
          <MessageSquare className="w-5 h-5" />
        )}
        {showOnlineDot && (
          <span className="absolute bottom-0 right-0 translate-x-[2px] translate-y-[2px] h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-white shadow-sm" />
        )}
      </Button>
    );
  };

  return (
    <div className="fixed bottom-24 right-4 z-50">
      {renderLauncher()}

      {isOpen && (
        <div className="w-80 sm:w-96 bg-white border shadow-2xl rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between bg-primary text-white px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white border border-white/40 overflow-hidden flex items-center justify-center">
                <img
                  src={headerIcon}
                  alt="Company icon"
                  className="h-full w-full object-cover"
                  onError={handleAvatarError}
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide opacity-80">Chat</p>
                <h3 className="text-lg font-semibold leading-tight text-white">{displayName}</h3>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={toggleOpen}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div ref={scrollRef} className="p-3 space-y-2 h-80 overflow-y-auto bg-slate-50">
            {loadingHistory && (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading conversation...
              </div>
            )}
            {messages.map((msg) => {
              const isAssistant = msg.role === "assistant";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${isAssistant ? "justify-start" : "justify-end"}`}
                >
                  {isAssistant && (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      onError={handleAvatarError}
                      className="h-7 w-7 rounded-full border border-slate-200 object-cover mt-0.5"
                    />
                  )}
                  <div
                    className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                      isAssistant ? "bg-white border text-slate-800" : "bg-primary text-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words leading-snug">
                      {renderMarkdown(msg.content, (path) => {
                        setLocation(path);
                        setIsOpen(true);
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
            {isSending && (
              <div className="flex gap-2 justify-start">
                <img
                  src={avatarUrl}
                  alt={displayName}
                  onError={handleAvatarError}
                  className="h-7 w-7 rounded-full border border-slate-200 object-cover mt-0.5"
                />
                <div className="rounded-lg px-3 py-2.5 text-sm bg-white border text-slate-800">
                  <div className="flex items-center justify-center gap-1 h-4">
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></span>
                  </div>
                </div>
              </div>
            )}
            {messages.length === 0 && !loadingHistory && (
              <p className="text-sm text-muted-foreground text-center py-8">Ask us anything about services or availability.</p>
            )}
          </div>

          <div className="border-t p-3">
            {limitReached ? (
              <Button onClick={startNewConversation} className="w-full" variant="outline">
                Start New Conversation
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  disabled={isSending}
                  data-testid="input-chat-message"
                />
                <Button onClick={sendMessage} disabled={isSending || !input.trim()} size="icon" className="shrink-0">
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
