'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { 
  MessageCircle, 
  X, 
  Send, 
  Loader2,
  Bot,
  User,
  Sparkles,
  ChevronDown,
  Mic
} from 'lucide-react';
import api from '@/lib/api';

// Tipos para Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  options?: string[];
  quickReplies?: string[];
}

interface ChatState {
  isOpen: boolean;
  isLoading: boolean;
  messages: ChatMessage[];
  suggestions: string[];
}

export default function ChatbotWidget() {
  const [state, setState] = useState<ChatState>({
    isOpen: false,
    isLoading: false,
    messages: [],
    suggestions: [],
  });
  const [inputValue, setInputValue] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const baseTextRef = useRef<string>(''); // Texto base antes de iniciar gravação

  // Verificar suporte a reconhecimento de voz
  useEffect(() => {
    const supported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setSpeechSupported(supported);
    
    if (supported) {
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognitionClass();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'pt-BR';

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        // Processar apenas o resultado atual, não acumular
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript = transcript;
          } else {
            interimTranscript = transcript;
          }
        }
        
        // Usar o texto base + novo texto (sem acumular)
        const base = baseTextRef.current;
        const separator = base ? ' ' : '';
        
        if (finalTranscript) {
          // Resultado final - definir como texto base + resultado
          const newText = base + separator + finalTranscript;
          setInputValue(newText);
          baseTextRef.current = newText; // Atualizar base para próxima gravação
        } else if (interimTranscript) {
          // Resultado intermediário - mostrar preview sem alterar base
          setInputValue(base + separator + interimTranscript);
        }
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Função para iniciar/parar reconhecimento de voz
  const toggleVoiceRecognition = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      // Salvar o texto atual como base antes de iniciar
      baseTextRef.current = inputValue;
      try {
        recognitionRef.current.start();
      } catch (error) {
        // Reconhecimento já pode estar ativo
        console.error('Erro ao iniciar reconhecimento de voz:', error);
      }
    }
  };

  // Scroll para última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  // Iniciar sessão ao abrir
  const startSession = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await api.post('/chatbot/session');
      
      if (response.data.success) {
        const data = response.data.data;
        
        setState(prev => ({
          ...prev,
          isLoading: false,
          messages: [{
            role: 'assistant',
            content: data.response,
            timestamp: new Date(),
            options: data.options,
            quickReplies: data.quickReplies,
          }],
        }));
      }
    } catch (error) {
      console.error('Erro ao iniciar sessão:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        messages: [{
          role: 'assistant',
          content: 'Olá! 👋 Sou o Utop Assistant, seu guia financeiro. Posso te ajudar a organizar suas finanças. Vamos começar?',
          timestamp: new Date(),
          quickReplies: ['Novo gasto', 'Meu saldo', 'Ajuda'],
        }],
      }));
    }
  }, []);

  // Abrir/fechar chat
  const toggleChat = () => {
    const newIsOpen = !state.isOpen;
    setState(prev => ({ ...prev, isOpen: newIsOpen }));
    
    if (newIsOpen && state.messages.length === 0) {
      startSession();
    }
    
    if (newIsOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Enviar mensagem
  const sendMessage = async (message: string) => {
    if (!message.trim() || state.isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setState(prev => ({
      ...prev,
      isLoading: true,
      messages: [...prev.messages, userMessage],
    }));
    setInputValue('');
    baseTextRef.current = ''; // Limpar base ao enviar

    try {
      const response = await api.post('/chatbot/message', { message });
      
      if (response.data.success) {
        const data = response.data.data;
        
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          options: data.options,
          quickReplies: data.quickReplies,
        };

        setState(prev => ({
          ...prev,
          isLoading: false,
          messages: [...prev.messages, assistantMessage],
        }));
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro. Tente novamente.',
        timestamp: new Date(),
        quickReplies: ['Tentar novamente'],
      };

      setState(prev => ({
        ...prev,
        isLoading: false,
        messages: [...prev.messages, errorMessage],
      }));
    }
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  // Handle quick reply click
  const handleQuickReply = (reply: string) => {
    sendMessage(reply);
  };

  // Formatar mensagem (markdown simples)
  const formatMessage = (content: string) => {
    return content
      .split('\n')
      .map((line, i) => {
        // Bold
        line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Italic
        line = line.replace(/_(.+?)_/g, '<em>$1</em>');
        // Emoji numbers to actual formatting
        line = line.replace(/^([1-9]️⃣)\s*(.+)$/, '<div class="flex gap-2"><span>$1</span><span>$2</span></div>');
        
        return line;
      })
      .join('<br/>');
  };

  // Widget minimizado
  if (!state.isOpen) {
    return (
      <button
        onClick={toggleChat}
        className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-[#1F4FD8] to-[#2ECC9A] rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group z-40"
        title="Falar com Utop Assistant"
      >
        <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white group-hover:scale-110 transition-transform" />
        
        {/* Indicador de notificação */}
        <span className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-[#2ECC9A] rounded-full border-2 border-white animate-pulse" />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-96 bg-white sm:rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden transition-all duration-300 ${isMinimized ? 'h-16' : 'h-[100dvh] sm:h-[600px] sm:max-h-[80vh]'}`}>
      {/* Header */}
      <div 
        className="bg-gradient-to-r from-[#1F4FD8] to-[#2ECC9A] text-white p-4 flex items-center justify-between cursor-pointer"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold">Utop Assistant</h3>
            <p className="text-xs text-white/80">Seu guia financeiro</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
          >
            <ChevronDown className={`w-5 h-5 transition-transform ${isMinimized ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggleChat(); }}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {state.messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1F4FD8] to-[#2ECC9A] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div className={`max-w-[80%] ${message.role === 'user' ? 'order-first' : ''}`}>
                  <div
                    className={`px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-[#1F4FD8] text-white rounded-br-md'
                        : 'bg-white text-[#0F172A] rounded-bl-md shadow-sm'
                    }`}
                    dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                  />
                  
                  {/* Options */}
                  {message.options && message.options.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {message.options.map((option, i) => (
                        <button
                          key={i}
                          onClick={() => handleQuickReply(option.replace(/^[0-9]️⃣\s*/, ''))}
                          className="block w-full text-left px-3 py-2 text-sm bg-white hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors text-gray-900"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading */}
            {state.isLoading && (
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1F4FD8] to-[#1A44BF] flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          {state.messages.length > 0 && state.messages[state.messages.length - 1].quickReplies && (
            <div className="px-4 py-2 bg-white border-t border-gray-100 flex flex-wrap gap-2">
              {state.messages[state.messages.length - 1].quickReplies!.map((reply, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickReply(reply)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-200">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isListening ? "Ouvindo..." : "Digite sua mensagem..."}
                className={`flex-1 px-4 py-2.5 min-h-[44px] bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-[#1F4FD8]/50 text-sm text-gray-900 placeholder:text-gray-400 ${isListening ? 'ring-2 ring-red-400' : ''}`}
                disabled={state.isLoading}
              />
              {/* Botão de Microfone - apenas em navegadores compatíveis */}
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleVoiceRecognition}
                  disabled={state.isLoading}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                    isListening 
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={isListening ? "Parar gravação" : "Falar mensagem"}
                >
                  <Mic className={`w-5 h-5 ${isListening ? 'text-white' : 'text-gray-600'}`} />
                </button>
              )}
              <button
                type="submit"
                disabled={!inputValue.trim() || state.isLoading}
                className="w-10 h-10 bg-[#1F4FD8] hover:bg-[#1A44BF] disabled:bg-gray-300 text-white rounded-full flex items-center justify-center transition-colors"
              >
                {state.isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            {/* Indicador de gravação */}
            {isListening && (
              <p className="text-xs text-red-500 mt-2 text-center animate-pulse">
                🎤 Ouvindo... Fale agora (processado localmente no navegador)
              </p>
            )}
          </form>
        </>
      )}
    </div>
  );
}
