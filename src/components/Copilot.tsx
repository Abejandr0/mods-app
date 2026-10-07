import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { MessageSquare, Send, Bot, User, AlertTriangle } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  isError?: boolean;
  modifications?: any;
  warnings?: string[];
}

export function Copilot() {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    text: '¡Hola! Soy tu Copiloto ModSim. Dime qué buscas (ej: "Quiero más aceleración para ciudad") y te recomendaré la mejor modificación.'
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { baseBike, modifications, updateSprocket, updateChainring, updateRearTire } = useStore();

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userPrompt = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userPrompt }]);
    setLoading(true);

    if (!window.electronAPI) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        text: 'Error: El contexto de Electron no está disponible. ¿Estás ejecutando la app en el navegador web en vez de Electron?',
        isError: true 
      }]);
      setLoading(false);
      return;
    }

    const currentConfig = {
      base: baseBike.name,
      ...modifications
    };

    const response = await window.electronAPI.askCopilot(userPrompt, currentConfig);
    
    setLoading(false);
    if (!response.success) {
      setMessages(prev => [...prev, { role: 'assistant', text: `Hubo un error de conexión: ${response.error}`, isError: true }]);
      return;
    }

    const data = response.data;
    setMessages(prev => [...prev, {
      role: 'assistant',
      text: data.explanation || 'Aquí tienes una sugerencia.',
      modifications: data.modifications,
      warnings: data.warnings
    }]);
  };

  const applyModifications = (mods: any) => {
    if (!mods) return;
    if (mods.sprocket) updateSprocket(mods.sprocket);
    if (mods.chainring) updateChainring(mods.chainring);
    if (mods.rearTire) updateRearTire(mods.rearTire);
  };

  return (
    <div className="copilot-container">
      <div className="copilot-header">
        <MessageSquare size={18} /> Copiloto Inteligente
      </div>
      
      <div className="copilot-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role === 'user' ? 'msg-user' : 'msg-assistant'}`}>
            <div className="msg-icon">
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className="msg-content">
              <p style={{ color: msg.isError ? 'var(--accent-danger)' : 'inherit', marginBottom: msg.warnings || msg.modifications ? 12 : 0 }}>{msg.text}</p>
              
              {msg.warnings && msg.warnings.length > 0 && (
                <div className="msg-warnings">
                  {msg.warnings.map((w, wIdx) => (
                    <div key={wIdx} className="warning-item">
                      <AlertTriangle size={14} /> {w}
                    </div>
                  ))}
                </div>
              )}

              {msg.modifications && Object.keys(msg.modifications).length > 0 && (
                <button 
                  className="btn-apply-mods" 
                  onClick={() => applyModifications(msg.modifications)}
                >
                  Aplicar Modificaciones
                </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="message msg-assistant">
            <div className="msg-icon"><Bot size={16} /></div>
            <div className="msg-content" style={{ opacity: 0.7 }}>Analizando física...</div>
          </div>
        )}
      </div>

      <div className="copilot-input-area">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ej: Necesito más velocidad final..."
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
