import React, { useEffect, useState, useRef } from 'react';
import { WEBCHAT_CONFIG } from '../config';

const RasaChatWidget = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [widgetInstance, setWidgetInstance] = useState(null);
  const widgetContainerRef = useRef(null);
  
  useEffect(() => {
    // Clean up function for when component unmounts
    const cleanup = () => {
      if (widgetInstance) {
        try {
          const socket = widgetInstance.getSocket();
          if (socket && socket.connected) {
            socket.disconnect();
          }
        } catch (e) {
          console.error('Error during cleanup:', e);
        }
      }
      
      const script = document.getElementById('rasa-webchat-script');
      if (script) {
        document.body.removeChild(script);
      }
    };

    // Implementation of direct WebChat initialization
    const initializeWebChat = () => {
      if (!window.WebChat || !window.WebChat.default) {
        console.error('WebChat library not loaded properly');
        setLoadError('WebChat library not available');
        return;
      }
      
      try {
        console.log('Initializing WebChat with simplified configuration');
        
        // Create simple configuration
        const instance = window.WebChat.default({
          selector: "#rasa-webchat-container",
          initPayload: "/greet",
          socketUrl: "http://localhost:5005",
          socketPath: "/socket.io/",
          title: "Finstock Assistant",
          subtitle: "Your AI Financial Assistant",
          params: { storage: 'local' },
          customData: { userId: `user_${Date.now()}` },
          embedded: false
        });
        
        setWidgetInstance(instance);
        setIsLoaded(true);
        
        // Add manual socket event monitoring
        const socket = instance.getSocket();
        if (socket) {
          console.log('Socket object retrieved, setting up monitors');
          
          socket.on('connect', () => {
            console.log('Socket connected event triggered');
          });
          
          socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
          });
          
          socket.on('bot_uttered', (message) => {
            console.log('Bot message received:', message);
          });
          
          socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            setLoadError(`Connection error: ${error.message}`);
          });
        } else {
          console.error('Failed to retrieve socket from instance');
          setLoadError('Could not establish WebSocket connection');
        }
      } catch (error) {
        console.error('WebChat initialization error:', error);
        setLoadError(`Initialization error: ${error.message}`);
      }
    };

    // Load the WebChat script dynamically
    const loadWebchatScript = () => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/rasa-webchat@1.0.1/lib/index.js';
      script.async = true;
      script.id = 'rasa-webchat-script';
      
      script.onload = () => {
        console.log('WebChat script loaded successfully');
        // Wait a moment for the library to initialize fully
        setTimeout(initializeWebChat, 500);
      };
      
      script.onerror = (error) => {
        console.error('Failed to load WebChat script:', error);
        setLoadError('Failed to load WebChat script');
      };
      
      document.body.appendChild(script);
    };

    // Start the loading process
    loadWebchatScript();
    
    // Return cleanup function
    return cleanup;
  }, []);

  return (
    <div className="chat-widget-container">
      <div
        id="rasa-webchat-container"
        ref={widgetContainerRef}
        style={{
          width: '100%',
          height: '500px',
          border: '1px solid #e0e0e0',
          borderRadius: '4px'
        }}
      />
      
      {!isLoaded && !loadError && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          Loading chat widget...
        </div>
      )}
      
      {loadError && (
        <div style={{ 
          color: 'red', 
          padding: '10px', 
          textAlign: 'center',
          backgroundColor: '#fff0f0',
          border: '1px solid #ffcccc',
          borderRadius: '4px',
          margin: '10px 0'
        }}>
          Error: {loadError}
          <div style={{ marginTop: '10px' }}>
            <button 
              onClick={() => window.location.reload()} 
              style={{ padding: '5px 10px' }}
            >
              Reload Page
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RasaChatWidget;
