import React, { useState, useRef, useEffect } from "react";
import "./ChatBot.css";

export default function ChatBot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const messagesEndRef = useRef(null);

  const toggleChat = () => setOpen(!open);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (sender, text, status = "Sent") => {
    setMessages((prev) => [...prev, { sender, text, status }]);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    addMessage("user", input);
    const prompt = input;
    setInput("");

    addMessage("ai", "AI is typing...", "");

    try {
      const response = await fetch("http://localhost:8000/users/ask/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();

      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          sender: "ai",
          text: data.answer,
          status: "Sent",
        };
        return newMessages;
      });
    } catch (err) {
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = {
          sender: "ai",
          text: "AI is unavailable.",
          status: "Error",
        };
        return newMessages;
      });
      console.error(err);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button className="chat-toggle-btn" onClick={toggleChat}>
        AI
      </button>

      {/* Chat Container */}
      <div className={`chat-container ${open ? "open" : ""}`}>
        <ul className="chat-messages">
          {messages.map((msg, idx) => (
            <li
              key={idx}
              className={`chat-message ${msg.sender === "user" ? "user" : "ai"}`}
            >
              {msg.sender === "ai" && (
                <img
                  className="avatar"
                  src="https://videos.openai.com/az/vg-assets/assets%2Ftask_01k86e1pkzep7r2ace8nnr6s2d%2F1761152717_img_0.webp"
                  alt="AI Avatar"
                />
              )}
              <div className={`message-bubble ${msg.sender}`}>
                <p>{msg.text}</p>
                <span className="status">{msg.status}</span>
              </div>
              {msg.sender === "user" && (
                <img
                  className="avatar"
                  src="https://videos.openai.com/az/vg-assets/assets%2Ftask_01k86ecpjqf4hsm2wb0t5wpke1%2F1761153082_img_0.webp"
                  alt="User Avatar"
                />
              )}
            </li>
          ))}
          <div ref={messagesEndRef} />
        </ul>

        {/* Input */}
        <div className="chat-input-container">
          <input
            type="text"
            className="chat-input"
            placeholder="Ask me anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button className="send-btn" onClick={sendMessage}>
            Send
          </button>
        </div>
      </div>
    </>
  );
}
