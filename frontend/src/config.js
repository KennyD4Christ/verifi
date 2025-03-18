const getEnvVariable = (key, defaultValue) => {
  // Check if running in browser with global ENV
  if (typeof window !== 'undefined' && window.ENV && window.ENV[key]) {
    return window.ENV[key];
  }
  
  // Fallback for webpack/bundler environment variables
  if (import.meta && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  
  // Fallback for Create React App
  if (
    typeof process !== 'undefined' && 
    process.env && 
    process.env[key]
  ) {
    return process.env[key];
  }
  
  // Return default if no environment variable found
  return defaultValue;
};

export const WEBCHAT_CONFIG = {
  SOCKET_URL: "http://localhost:5005",
  INIT_PAYLOAD: "/greet",
  TITLE: "Assistant",
  SUBTITLE: "How can I help you today?"
};

// Fallback configuration method
export const setRuntimeConfig = (config = {}) => {
  if (typeof window !== 'undefined') {
    window.ENV = window.ENV || {};
    Object.assign(window.ENV, config);
  }
};
