import React, { useState, useEffect, useRef } from 'react';
import './ChatBot.css';

type Message = { sender: 'bot' | 'user'; text: string };

export default function ChatBot(): JSX.Element {
  const [open, setOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'bot', text: 'Hello! How can I assist you today?' },
  ]);
  const [input, setInput] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const env = (import.meta as any)?.env || {};
  const apiUrl =
    env.VITE_SERVER_URL ||
    env.REACT_APP_SERVER_URL ||
    'http://localhost:8000/users/ask/';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const toggleChat = () => setOpen((prev) => !prev);

  const addMessage = (text: string, sender: 'bot' | 'user' = 'user') => {
    setMessages((prev) => [...prev, { sender, text }]);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    addMessage(userMessage, 'user');
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage }),
      });

      const data = await response.json();
      setIsTyping(false);
      addMessage(data.answer || 'No response received.', 'bot');
    } catch (error) {
      console.error(error);
      setIsTyping(false);
      addMessage(
        'AI is unavailable right now. Please try again later.',
        'bot'
      );
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendMessage();
  };

  return (
    <>
      <div className="chat-bubble" onClick={toggleChat}>
        <span className="chat-bubble-icon">{open ? '⌑' : '💬'}</span>
      </div>

      <div className={`chat-window ${open ? 'active' : ''}`}>
        <div className="chat-header">
          <span>ChatBot</span>
          <button className="close-button" onClick={toggleChat}>
            ×
          </button>
        </div>

        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`message ${msg.sender === 'user' ? 'sent' : 'received'}`}
            >
              {msg.text} {/* Render as plain text to avoid extra characters */}
            </div>
          ))}

          {isTyping && (
            <div className="message received">
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input">
          <input
            type="text"
            className="message-input"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
          />
          <button className="send-button" onClick={sendMessage}>
            ↑
          </button>
        </div>
      </div>
    </>
  );
}
