import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const SimpleChatWidget = () => {
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! I'm your financial assistant. How can I help you today?", sender: 'bot' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
    // Focus the input field when component mounts
    inputRef.current?.focus();
  }, [messages]);
  
  const sendMessage = async () => {
    if (!inputText.trim()) return;
    
    // Add user message to chat
    const userMessage = {
      id: messages.length + 1,
      text: inputText,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Send message to Rasa REST API
      const response = await axios.post('http://localhost:5005/webhooks/rest/webhook', {
        sender: 'user',
        message: inputText
      });

      // Process bot responses
      if (response.data && response.data.length > 0) {
        response.data.forEach((botResponse, index) => {
          setMessages(prev => [
            ...prev,
            {
              id: messages.length + 2 + index,
              text: botResponse.text,
              sender: 'bot',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
        });
      } else {
        // Fallback if no response
        setMessages(prev => [
          ...prev,
          {
            id: messages.length + 2,
            text: "I'm sorry, I couldn't process that request.",
            sender: 'bot',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (error) {
      console.error('Error sending message to Rasa:', error);
      setMessages(prev => [
        ...prev,
        {
          id: messages.length + 2,
          text: "Sorry, there was an error communicating with the assistant.",
          sender: 'bot',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
      // Focus the input field after sending a message
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="chat-container" style={{
      width: '100%',
      height: '500px',
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid #e0e0e0',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, sans-serif'
    }}>
      <div className="chat-header" style={{
        padding: '16px 20px',
        backgroundColor: '#0a2f5e',
        color: 'white',
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ 
            width: '32px', 
            height: '32px', 
            backgroundColor: '#1a73e8', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: 'bold'
          }}>F</div>
          <span>Finstock Assistant</span>
        </div>
        <div style={{ 
          fontSize: '12px', 
          backgroundColor: 'rgba(255,255,255,0.2)', 
          padding: '4px 8px', 
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <span style={{ 
            width: '8px', 
            height: '8px', 
            backgroundColor: '#4caf50', 
            borderRadius: '50%', 
            marginRight: '6px' 
          }}></span>
          Online
        </div>
      </div>

      <div className="messages-container" style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        backgroundColor: '#f8f9fb'
      }}>
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`message-wrapper ${msg.sender}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '12px'
            }}
          >
            <div className={`message ${msg.sender}`}
              style={{
                maxWidth: '75%',
                padding: '12px 16px',
                borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                backgroundColor: msg.sender === 'user' ? '#1a73e8' : 'white',
                color: msg.sender === 'user' ? 'white' : '#333',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                position: 'relative',
                fontSize: '14px',
                lineHeight: '1.5'
              }}
            >
              {msg.text}
            </div>
            <div className="timestamp" style={{
              fontSize: '11px',
              color: '#888',
              marginTop: '4px',
              padding: '0 8px'
            }}>
              {msg.timestamp || ''}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="typing-indicator-wrapper" style={{
            alignSelf: 'flex-start',
            marginBottom: '12px'
          }}>
            <div className="typing-indicator" style={{
              backgroundColor: 'white',
              padding: '12px 16px',
              borderRadius: '18px 18px 18px 4px',
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  backgroundColor: '#1a73e8',
                  borderRadius: '50%',
                  animation: 'bounce 1.4s infinite ease-in-out both',
                  animationDelay: '0s'
                }}></div>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  backgroundColor: '#1a73e8',
                  borderRadius: '50%',
                  animation: 'bounce 1.4s infinite ease-in-out both',
                  animationDelay: '0.2s'
                }}></div>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  backgroundColor: '#1a73e8',
                  borderRadius: '50%',
                  animation: 'bounce 1.4s infinite ease-in-out both',
                  animationDelay: '0.4s'
                }}></div>
              </div>
            </div>
            <style>
              {`
                @keyframes bounce {
                  0%, 80%, 100% { transform: scale(0); }
                  40% { transform: scale(1.0); }
                }
              `}
            </style>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area" style={{
        display: 'flex',
        padding: '16px',
        borderTop: '1px solid #e0e0e0',
        backgroundColor: 'white'
      }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Ask something about your finances..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          style={{
            flex: 1,
            padding: '12px 16px',
            border: '1px solid #e0e0e0',
            borderRadius: '24px',
            marginRight: '12px',
            outline: 'none',
            fontSize: '14px',
            transition: 'border-color 0.3s, box-shadow 0.3s',
            boxShadow: inputText ? '0 0 0 2px rgba(26, 115, 232, 0.2)' : 'none',
            borderColor: inputText ? '#1a73e8' : '#e0e0e0'
          }}
          disabled={isLoading}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !inputText.trim()}
          style={{
            backgroundColor: '#1a73e8',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: isLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
            opacity: isLoading || !inputText.trim() ? 0.7 : 1,
            boxShadow: '0 2px 6px rgba(26, 115, 232, 0.3)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            transform: isLoading || !inputText.trim() ? 'none' : 'scale(1.02)',
            fontSize: '20px'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default SimpleChatWidget;
