import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const EnhancedChatWidget = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! I'm your financial assistant. How can I help you today?", sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(true); // Track online status
  const [typingIndicator, setTypingIndicator] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  // Mock online status check
  useEffect(() => {
    const checkOnlineStatus = () => {
      // In production, replace with actual API status check
      const online = navigator.onLine && Math.random() > 0.1; // 90% chance to be online
      setIsOnline(online);
    };
    
    // Initialize and set interval check
    checkOnlineStatus();
    const interval = setInterval(checkOnlineStatus, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  // Clear error when chat is toggled
  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

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
    setError(null);
    
    // Show typing indicator
    setTypingIndicator(true);

    try {
      // Get the current auth token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Simulate network delay for better UX
      await new Promise(resolve => setTimeout(resolve, 700));

      // Send message to Rasa REST API with user authentication info
      const response = await axios.post('http://localhost:5005/webhooks/rest/webhook', {
        sender: user?.id || 'anonymous',
        message: inputText
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      // Process bot responses
      if (response.data && response.data.length > 0) {
        response.data.forEach((botResponse, index) => {
          // Stagger multiple messages for better UX
          setTimeout(() => {
            setMessages(prev => [
              ...prev,
              {
                id: messages.length + 2 + index,
                text: botResponse.text,
                sender: 'bot',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);
          }, index * 400);
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
      setError(error.message);

      // Check if it's an authentication error
      const isAuthError =
        error.response?.status === 401 ||
        error.message === 'Authentication token not found';

      const errorMessage = isAuthError
        ? "Authentication failed. Please try logging in again."
        : "Sorry, there was an error communicating with the assistant.";

      setMessages(prev => [
        ...prev,
        {
          id: messages.length + 2,
          text: errorMessage,
          sender: 'bot',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      // If it's an auth error, you might want to redirect to login
      if (isAuthError && typeof window !== 'undefined') {
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
      }
    } finally {
      setIsLoading(false);
      setTypingIndicator(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  // Format timestamp to show AM/PM
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return timestamp;
  };

  // Chat bubble button that appears when chat is closed
  const renderChatButton = () => (
    <div
      className="chat-button"
      onClick={toggleChat}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        backgroundColor: '#1a73e8',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(26, 115, 232, 0.4)',
        transition: 'all 0.3s ease',
        zIndex: 1000,
        color: 'white',
        fontSize: '24px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.boxShadow = '0 6px 24px rgba(26, 115, 232, 0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(26, 115, 232, 0.4)';
      }}
    >
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/> 
        </svg>
        
        {/* Notification badge - show unread count or online status */}
        <div style={{
          position: 'absolute',
          top: '-5px',
          right: '-5px',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: isOnline ? '#4CAF50' : '#F44336',
          border: '2px solid white'
        }} />
      </div>
    </div>
  );

  // Full chat container that appears when chat is open
  const renderChatContainer = () => (
    <div className="chat-container" style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      width: '350px',
      height: '500px',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 6px 30px rgba(0, 0, 0, 0.15)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      animation: 'fadeIn 0.3s'
    }}>
      {/* Chat header */}
      <div style={{
        padding: '15px',
        backgroundImage: 'linear-gradient(135deg, #1a73e8, #1e88e5)',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ 
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#0d47a1',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: '10px'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" fill="white"/>
              <path d="M12 14C7.58172 14 4 17.5817 4 22H20C20 17.5817 16.4183 14 12 14Z" fill="white"/>
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Financial Assistant</h3>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isOnline ? '#4CAF50' : '#F44336',
                marginRight: '5px'
              }} />
              {isOnline ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>
        <button
          onClick={toggleChat}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '16px',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            outline: 'none',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
          }}
        >
          ×
        </button>
      </div>

      {/* Messages container */}
      <div style={{
        flexGrow: 1,
        overflowY: 'auto',
        padding: '15px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        backgroundColor: '#f8f9fa'
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{
              padding: '12px 16px',
              borderRadius: msg.sender === 'user' ? '18px 18px 0 18px' : '18px 18px 18px 0',
              backgroundColor: msg.sender === 'user' ? '#1a73e8' : 'white',
              color: msg.sender === 'user' ? 'white' : '#333',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              {msg.text}
            </div>
            <div style={{
              fontSize: '11px',
              color: '#666',
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              paddingLeft: msg.sender === 'user' ? '0' : '8px',
              paddingRight: msg.sender === 'user' ? '8px' : '0',
            }}>
              {formatTime(msg.timestamp)}
            </div>
          </div>
        ))}
        
        {/* Typing indicator */}
        {typingIndicator && (
          <div style={{
            alignSelf: 'flex-start',
            padding: '12px 16px',
            borderRadius: '18px 18px 18px 0',
            backgroundColor: 'white',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div className="typing-dot" style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#888',
                animation: 'typingAnimation 1.4s infinite ease-in-out',
                animationDelay: '0s'
              }} />
              <div className="typing-dot" style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#888',
                animation: 'typingAnimation 1.4s infinite ease-in-out',
                animationDelay: '0.2s'
              }} />
              <div className="typing-dot" style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#888',
                animation: 'typingAnimation 1.4s infinite ease-in-out',
                animationDelay: '0.4s'
              }} />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Error message if any */}
      {error && (
        <div style={{
          padding: '10px 15px',
          backgroundColor: '#ffebee',
          color: '#c62828',
          fontSize: '13px',
          textAlign: 'center',
          boxShadow: '0 -1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#c62828" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 8V12" stroke="#c62828" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="16" r="1" fill="#c62828"/>
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Connection status indicator */}
      <div style={{
        padding: '8px 15px',
        backgroundColor: isOnline ? '#e8f5e9' : '#ffebee',
        color: isOnline ? '#2e7d32' : '#c62828',
        fontSize: '12px',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isOnline ? '#4CAF50' : '#F44336'
        }} />
        {isOnline ? 'Connected' : 'Connection lost. Trying to reconnect...'}
      </div>

      {/* Input area */}
      <div style={{
        padding: '15px',
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        backgroundColor: 'white',
        position: 'relative'
      }}>
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          style={{
            flexGrow: 1,
            padding: '12px 15px',
            borderRadius: '24px',
            border: '1px solid #e0e0e0',
            outline: 'none',
            marginRight: '10px',
            fontSize: '14px',
            boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.05)',
            transition: 'border-color 0.2s',
            ':focus': {
              borderColor: '#1a73e8',
              boxShadow: 'inset 0 1px 3px rgba(26, 115, 232, 0.2)'
            }
          }}
          disabled={isLoading || !isOnline}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !inputText.trim() || !isOnline}
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
            cursor: 'pointer',
            transition: 'all 0.2s',
            opacity: (isLoading || !inputText.trim() || !isOnline) ? 0.6 : 1,
            boxShadow: '0 2px 5px rgba(26, 115, 232, 0.3)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
      
      {/* CSS for animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes typingAnimation {
          0%, 50%, 100% { transform: translateY(0); }
          25% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );

  return (
    <>
      {!isOpen && renderChatButton()}
      {isOpen && renderChatContainer()}
    </>
  );
};

export default EnhancedChatWidget;
