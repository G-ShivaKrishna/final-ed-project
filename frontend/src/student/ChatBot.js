import React, { useState, useEffect, useRef } from "react";
import "./ChatBot.css";

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hello! How can I assist you today?" },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const apiUrl = `${process.env.REACT_APP_SERVER_URL || "http://localhost:8000/users/ask/"}`;

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const toggleChat = () => setOpen((prev) => !prev);

  const addMessage = (text, sender = "user") => {
    setMessages((prev) => [...prev, { sender, text }]);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    addMessage(userMessage, "user");
    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: userMessage }),
      });

      const data = await response.json();
      setIsTyping(false);
      addMessage(data.answer || "No response received.", "bot");
    } catch (error) {
      console.error(error);
      setIsTyping(false);
      addMessage("AI is unavailable right now. Please try again later.", "bot");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    <>
      {/* Floating Chat Button */}
      <div className="chat-bubble" onClick={toggleChat}>
        <span className="chat-bubble-icon">{open ? "⌑" : "💬"}</span>
      </div>

      {/* Chat Window */}
      <div className={`chat-window ${open ? "active" : ""}`}>
        <div className="chat-header">
          <span>ChatBot</span>
          <button className="close-button" onClick={toggleChat}>×</button>
        </div>

        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`message ${msg.sender === "user" ? "sent" : "received"}`}
              dangerouslySetInnerHTML={{ __html: msg.text }}
            />
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
          <button className="send-button" onClick={sendMessage}>↑</button>
        </div>
      </div>
    </>
  );
}
