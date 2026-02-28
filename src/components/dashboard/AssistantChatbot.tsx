import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { chatbotKnowledge, type ChatbotEntry } from "@/data/chatbotKnowledge";
import type { DashboardView } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  activeView: DashboardView;
  onNavigate: (view: string) => void;
}

interface Message {
  id: string;
  type: "user" | "bot";
  text: string;
  actions?: { label: string; view: string }[];
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "");
}

function findMatches(query: string): ChatbotEntry[] {
  const words = normalize(query).split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return [];

  const scored = chatbotKnowledge.map((entry) => {
    let score = 0;
    const normalizedKeywords = entry.keywords.map(normalize);
    for (const word of words) {
      for (const kw of normalizedKeywords) {
        if (kw.includes(word) || word.includes(kw)) {
          score += 1;
        }
      }
    }
    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.entry);
}

const contextualShortcuts: Partial<Record<DashboardView, { label: string; query: string }[]>> = {
  cuisine: [
    { label: "Gerer les ruptures", query: "rupture" },
    { label: "Bannir un client", query: "bannir client" },
  ],
  carte: [
    { label: "Ajouter des supplements", query: "supplement" },
    { label: "Traduire les categories", query: "langue traduction" },
  ],
  stats: [
    { label: "Comprendre les stats", query: "statistique performance" },
  ],
  "en-direct": [
    { label: "Voir les alertes", query: "visiteur direct" },
  ],
};

export const AssistantChatbot = ({ activeView, onNavigate }: Props) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSend = (query?: string) => {
    const q = query || input.trim();
    if (!q) return;
    setInput("");

    const userMsg: Message = {
      id: Date.now().toString(),
      type: "user",
      text: q,
    };
    setMessages((prev) => [...prev, userMsg]);

    const matches = findMatches(q);
    let botMsg: Message;

    if (matches.length > 0) {
      const texts = matches.map((m) => `**${m.question}**\n${m.answer}`).join("\n\n");
      const actions = matches
        .filter((m) => m.action)
        .map((m) => m.action!);
      botMsg = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        text: texts,
        actions: actions.length > 0 ? actions : undefined,
      };
    } else {
      botMsg = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        text: "Je n'ai pas trouve de reponse a votre question. Contactez-nous a contact@commandemaintenant.com pour plus d'aide.",
      };
    }

    setTimeout(() => {
      setMessages((prev) => [...prev, botMsg]);
    }, 300);
  };

  const handleAction = (view: string) => {
    if (view === "__onboarding__") {
      // Trigger onboarding restart
      const slug = window.location.pathname.split("/admin/")[1]?.split("?")[0];
      if (slug) localStorage.removeItem(`cm_onboarding_done_${slug}`);
      window.location.reload();
      return;
    }
    onNavigate(view);
    setOpen(false);
  };

  const shortcuts = contextualShortcuts[activeView] || [];

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-20 lg:bottom-6 right-4 z-50 w-12 h-12 rounded-full bg-foreground text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
            aria-label="Ouvrir l'assistant"
          >
            <MessageCircle className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 lg:bottom-6 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm bg-card border border-border rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: "min(70vh, 500px)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <p className="text-sm font-semibold text-foreground">Assistant Commandez</p>
                <p className="text-xs text-muted-foreground">Posez votre question</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-secondary">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Comment puis-je vous aider ?</p>
                  {/* Contextual shortcuts */}
                  {shortcuts.map((s) => (
                    <button
                      key={s.query}
                      onClick={() => handleSend(s.query)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-secondary/50 text-sm text-foreground hover:bg-secondary transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                  {/* Default shortcuts */}
                  <button
                    onClick={() => handleSend("comment commencer guide")}
                    className="w-full text-left px-3 py-2 rounded-xl bg-secondary/50 text-sm text-foreground hover:bg-secondary transition-colors"
                  >
                    Revoir le guide de demarrage
                  </button>
                  <button
                    onClick={() => handleSend("contact aide")}
                    className="w-full text-left px-3 py-2 rounded-xl bg-secondary/50 text-sm text-foreground hover:bg-secondary transition-colors"
                  >
                    Contacter le support
                  </button>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                      msg.type === "user"
                        ? "bg-foreground text-primary-foreground"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    {msg.text.split("\n").map((line, i) => {
                      // Simple bold rendering
                      const parts = line.split(/\*\*(.*?)\*\*/g);
                      return (
                        <p key={i} className={i > 0 ? "mt-1.5" : ""}>
                          {parts.map((part, j) =>
                            j % 2 === 1 ? (
                              <strong key={j}>{part}</strong>
                            ) : (
                              <span key={j}>{part}</span>
                            )
                          )}
                        </p>
                      );
                    })}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {msg.actions.map((a) => (
                          <button
                            key={a.view}
                            onClick={() => handleAction(a.view)}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-foreground/10 hover:bg-foreground/20 transition-colors"
                          >
                            {a.label}
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-border">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex gap-2"
              >
                <Input
                  ref={inputRef}
                  placeholder="Tapez votre question..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="rounded-xl text-sm"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!input.trim()}
                  className="rounded-xl px-3"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
