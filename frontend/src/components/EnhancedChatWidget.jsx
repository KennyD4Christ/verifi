import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const EnhancedChatWidget = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! I'm your financial assistant. How can I help you with your accounting and inventory management today?", sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const [chatSize, setChatSize] = useState({ width: 350, height: 500 });
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const resizeStartPos = useRef(null);
  const chatContainerRef = useRef(null);
  
  // Scroll to bottom of chat when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  // Check online status
  useEffect(() => {
    const checkOnlineStatus = () => {
      // Replace with actual API status check in production
      const online = navigator.onLine && Math.random() > 0.1;
      setIsOnline(online);
    };

    checkOnlineStatus();
    const interval = setInterval(checkOnlineStatus, 60000);
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', () => setIsOnline(true));
      window.removeEventListener('offline', () => setIsOnline(false));
    };
  }, []);

  // Clear error when chat is toggled
  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  // Handle window resize events
  useEffect(() => {
    if (isResizing) {
      const handleMouseMove = (e) => {
        if (!resizeStartPos.current) return;
        
        const deltaX = resizeStartPos.current.x - e.clientX;
        const deltaY = resizeStartPos.current.y - e.clientY;
        
        // Calculate new dimensions with constraints
        const newWidth = Math.max(280, Math.min(600, chatSize.width + deltaX));
        const newHeight = Math.max(400, Math.min(800, chatSize.height + deltaY));
        
        setChatSize({ width: newWidth, height: newHeight });
        resizeStartPos.current = { x: e.clientX, y: e.clientY };
      };
      
      const handleMouseUp = () => {
        setIsResizing(false);
        resizeStartPos.current = null;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, chatSize]);

  // Save chat size to localStorage
  useEffect(() => {
    if (!isResizing) {
      localStorage.setItem('chatWidgetSize', JSON.stringify(chatSize));
    }
  }, [isResizing, chatSize]);

  // Load chat size from localStorage
  useEffect(() => {
    const savedSize = localStorage.getItem('chatWidgetSize');
    if (savedSize) {
      try {
        setChatSize(JSON.parse(savedSize));
      } catch (e) {
        console.error('Error parsing saved chat size:', e);
      }
    }
  }, []);

  const startResize = (e) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartPos.current = { x: e.clientX, y: e.clientY };
    document.body.style.cursor = 'nw-resize';
    document.body.style.userSelect = 'none';
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const minimizeChat = () => {
    setIsOpen(false);
  };

  const maximizeChat = () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    setChatSize({
      width: Math.min(600, viewportWidth * 0.9),
      height: Math.min(800, viewportHeight * 0.8)
    });
  };

  const resetChatSize = () => {
    setChatSize({ width: 350, height: 500 });
  };

  const clearChat = () => {
    const confirmClear = window.confirm("Are you sure you want to clear the chat history?");
    if (confirmClear) {
      setMessages([
        { id: 1, text: "Chat history cleared. How can I help with your accounting and inventory management?", sender: 'bot', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    if (!isOnline) {
      setError("You're currently offline. Please check your connection and try again.");
      return;
    }

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
            text: "I couldn't find the information you're looking for. Could you rephrase your question about your accounting or inventory?",
            sender: 'bot',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (error) {
      console.error('Error sending message to Rasa:', error);
      
      // Check if it's an authentication error
      const isAuthError =
        error.response?.status === 401 ||
        error.message === 'Authentication token not found';

      const errorMessage = isAuthError
        ? "Authentication failed. Please try logging in again."
        : "Sorry, there was an error communicating with the assistant. Please try again later.";

      setError(error.message);
      setMessages(prev => [
        ...prev,
        {
          id: messages.length + 2,
          text: errorMessage,
          sender: 'bot',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      // If it's an auth error, redirect to login
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Format message text with basic markdown-like formatting
  const formatMessageText = (text) => {
    // Process **bold** text
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Process _italic_ text
    formattedText = formattedText.replace(/_(.*?)_/g, '<em>$1</em>');
    
    // Process URLs
    formattedText = formattedText.replace(
      /(https?:\/\/[^\s]+)/g, 
      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">$1</a>'
    );
    
    // Process line breaks
    formattedText = formattedText.replace(/\n/g, '<br/>');
    
    return formattedText;
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

        {/* Notification badge */}
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
    <div 
      ref={chatContainerRef}
      className="chat-container" 
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: `${chatSize.width}px`,
        height: `${chatSize.height}px`,
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 6px 30px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: isResizing ? 'none' : 'all 0.3s ease',
        animation: 'fadeIn 0.3s',
        resize: 'both',
        maxWidth: '90vw',
        maxHeight: '90vh'
      }}
    >
      {/* Resize handle */}
      <div
        className="resize-handle"
        onMouseDown={startResize}
        style={{
          position: 'absolute',
          top: '0',
          left: '0',
          width: '16px',
          height: '16px',
          cursor: 'nw-resize',
          zIndex: 1001
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 0H4V4H0V0Z" fill="#1a73e8" fillOpacity="0.3" />
          <path d="M6 6H10V10H6V6Z" fill="#1a73e8" fillOpacity="0.3" />
          <path d="M12 12H16V16H12V12Z" fill="#1a73e8" fillOpacity="0.3" />
        </svg>
      </div>

      {/* Chat header with title and controls */}
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
              <path d="M21 8V20.5C21 20.7761 20.7761 21 20.5 21H3.5C3.22386 21 3 20.7761 3 20.5V8" stroke="white" strokeWidth="2"/>
              <path d="M22 6H2V4.5C2 4.22386 2.22386 4 2.5 4H21.5C21.7761 4 22 4.22386 22 4.5V6Z" stroke="white" strokeWidth="2"/>
              <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="white" strokeWidth="2"/>
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
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Reset size button */}
          <button
            onClick={resetChatSize}
            title="Reset Size"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              outline: 'none',
              padding: 0
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 15V19H8M8 5H4V9M20 15V19H16M16 5H20V9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          {/* Maximize button */}
          <button
            onClick={maximizeChat}
            title="Maximize"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              outline: 'none',
              padding: 0
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3H5C3.89543 3 3 3.89543 3 5V8M21 8V5C21 3.89543 20.1046 3 19 3H16M16 21H19C20.1046 21 21 20.1046 21 19V16M3 16V19C3 20.1046 3.89543 21 5 21H8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          {/* Clear chat button */}
          <button
            onClick={clearChat}
            title="Clear Chat"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              outline: 'none',
              padding: 0
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 6H21M5 6V20C5 21.1046 5.89543 22 7 22H17C18.1046 22 19 21.1046 19 20V6M8 6V4C8 2.89543 8.89543 2 10 2H14C15.1046 2 16 2.89543 16 4V6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 11V17M14 11V17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          
          {/* Minimize button */}
          <button
            onClick={minimizeChat}
            title="Minimize"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              outline: 'none',
              transition: 'background-color 0.2s',
              padding: 0
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
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
            }}
            dangerouslySetInnerHTML={{ __html: formatMessageText(msg.text) }}
            />
            <div style={{
              fontSize: '11px',
              color: '#666',
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              paddingLeft: msg.sender === 'user' ? '0' : '8px',
              paddingRight: msg.sender === 'user' ? '8px' : '0',
            }}>
              {msg.timestamp}
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
        gap: '6px',
        transition: 'background-color 0.3s'
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isOnline ? '#4CAF50' : '#F44336'
        }} />
        {isOnline ? 'Connected to accounting system' : 'Connection lost. Trying to reconnect...'}
      </div>

      {/* Suggestions chips */}
      <div style={{
        padding: '10px 15px',
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        overflowX: 'auto',
        gap: '8px',
        backgroundColor: '#f8f9fa'
      }}>
        {["Inventory status", "Recent transactions", "Account balance", "Generate report"].map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => setInputText(suggestion)}
            style={{
              padding: '8px 12px',
              borderRadius: '16px',
              border: '1px solid #e0e0e0',
              backgroundColor: 'white',
              color: '#1a73e8',
              fontSize: '12px',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.2s',
              outline: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f8fe';
              e.currentTarget.style.borderColor = '#1a73e8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'white';
              e.currentTarget.style.borderColor = '#e0e0e0';
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* Input area */}
<div style={{
  padding: '15px',
  borderTop: '1px solid #e0e0e0',
  display: 'flex',
  backgroundColor: 'white',
  position: 'relative'
}}>
  <textarea
    ref={inputRef}
    value={inputText}
    onChange={(e) => setInputText(e.target.value)}
    onKeyDown={handleKeyPress}
    placeholder="Ask about your accounting or inventory..."
    style={{
      flexGrow: 1,
      padding: '12px 15px',
      borderRadius: '24px',
      border: '1px solid #e0e0e0',
      outline: 'none',
      marginRight: '10px',
      fontSize: '14px',
      boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)',
      resize: 'none',
      minHeight: '44px',
      maxHeight: '120px',
      transition: 'all 0.2s',
      fontFamily: 'inherit'
    }}
  />
  <button
    onClick={sendMessage}
    disabled={isLoading || !isOnline || !inputText.trim()}
    style={{
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      backgroundColor: '#1a73e8',
      border: 'none',
      color: 'white',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      cursor: (isLoading || !isOnline || !inputText.trim()) ? 'not-allowed' : 'pointer',
      opacity: (isLoading || !isOnline || !inputText.trim()) ? 0.6 : 1,
      transition: 'all 0.2s',
      outline: 'none'
    }}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </button>
</div>

{/* Footer with version and info */}
<div style={{
  padding: '8px 15px',
  fontSize: '11px',
  color: '#666',
  textAlign: 'center',
  borderTop: '1px solid #f0f0f0',
  backgroundColor: 'white'
}}>
  Financial Assistant v1.2 | <a href="/help" target="_blank" rel="noopener noreferrer" style={{ color: '#1a73e8' }}>Help</a>
</div>

{/* CSS Animations */}
<style jsx>{`
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes typingAnimation {
    0% { transform: scale(0.5); opacity: 0.3; }
    50% { transform: scale(1); opacity: 1; }
    100% { transform: scale(0.5); opacity: 0.3; }
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
