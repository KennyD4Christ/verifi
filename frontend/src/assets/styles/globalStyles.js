import { createGlobalStyle } from 'styled-components';
import { normalize } from 'styled-normalize';

const GlobalStyle = createGlobalStyle`
  ${normalize}

  :root {
    --primary-color: #0645AD;
    --secondary-color: #043584;
    --text-color: #333;
    --background-color: #f5f5f5;
    --success-color: #28a745;
    --warning-color: #ffc107;
    --danger-color: #dc3545;
    --info-color: #17a2b8;
    --font-family: 'Arial', sans-serif;
    --transition-speed: 0.3s;
  }

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    font-size: 16px;
    line-height: 1.5;
    scroll-behavior: smooth;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    font-family: var(--font-family);
    color: var(--text-color);
    background-color: var(--background-color);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
  }

  #root {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  /* Typography */
  h1, h2, h3, h4, h5, h6 {
    font-weight: 600;
    line-height: 1.25;
    margin-bottom: 1rem;
  }

  h1 { font-size: 2.5rem; }
  h2 { font-size: 2rem; }
  h3 { font-size: 1.75rem; }
  h4 { font-size: 1.5rem; }
  h5 { font-size: 1.25rem; }
  h6 { font-size: 1rem; }

  p {
    margin: 0 0 1em;
  }

  a {
    text-decoration: none;
    color: var(--primary-color);
    transition: color var(--transition-speed);
    &:hover {
      color: var(--secondary-color);
    }
  }

  ul, ol {
    list-style: none;
    padding: 0;
    margin: 0 0 1em;
  }

  /* Form Elements */
  input, button, select, textarea {
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
  }

  button {
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    transition: all var(--transition-speed);
    &:focus {
      outline: none;
    }
    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  }

  /* Utility Classes */
  .container {
    width: 100%;
    margin-right: auto;
    margin-left: auto;
    padding-right: 15px;
    padding-left: 15px;
    @media (min-width: 576px) { max-width: 540px; }
    @media (min-width: 768px) { max-width: 720px; }
    @media (min-width: 992px) { max-width: 960px; }
    @media (min-width: 1200px) { max-width: 1140px; }
  }

  .clearfix::after {
    content: "";
    display: table;
    clear: both;
  }

  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .text-left { text-align: left; }

  .mt-1 { margin-top: 0.25rem; }
  .mt-2 { margin-top: 0.5rem; }
  .mt-3 { margin-top: 1rem; }
  .mt-4 { margin-top: 1.5rem; }
  .mt-5 { margin-top: 3rem; }

  .mb-1 { margin-bottom: 0.25rem; }
  .mb-2 { margin-bottom: 0.5rem; }
  .mb-3 { margin-bottom: 1rem; }
  .mb-4 { margin-bottom: 1.5rem; }
  .mb-5 { margin-bottom: 3rem; }

  .mx-1 { margin-left: 0.25rem; margin-right: 0.25rem; }
  .mx-2 { margin-left: 0.5rem; margin-right: 0.5rem; }
  .mx-3 { margin-left: 1rem; margin-right: 1rem; }
  .mx-4 { margin-left: 1.5rem; margin-right: 1.5rem; }
  .mx-5 { margin-left: 3rem; margin-right: 3rem; }

  .my-1 { margin-top: 0.25rem; margin-bottom: 0.25rem; }
  .my-2 { margin-top: 0.5rem; margin-bottom: 0.5rem; }
  .my-3 { margin-top: 1rem; margin-bottom: 1rem; }
  .my-4 { margin-top: 1.5rem; margin-bottom: 1.5rem; }
  .my-5 { margin-top: 3rem; margin-bottom: 3rem; }

  .p-1 { padding: 0.25rem; }
  .p-2 { padding: 0.5rem; }
  .p-3 { padding: 1rem; }
  .p-4 { padding: 1.5rem; }
  .p-5 { padding: 3rem; }

  .d-none { display: none; }
  .d-block { display: block; }
  .d-inline-block { display: inline-block; }
  .d-flex { display: flex; }

  .flex-column { flex-direction: column; }
  .justify-content-center { justify-content: center; }
  .align-items-center { align-items: center; }

  .w-100 { width: 100%; }
  .h-100 { height: 100%; }

  .text-primary { color: var(--primary-color); }
  .text-secondary { color: var(--secondary-color); }
  .text-success { color: var(--success-color); }
  .text-warning { color: var(--warning-color); }
  .text-danger { color: var(--danger-color); }
  .text-info { color: var(--info-color); }

  .bg-primary { background-color: var(--primary-color); }
  .bg-secondary { background-color: var(--secondary-color); }
  .bg-success { background-color: var(--success-color); }
  .bg-warning { background-color: var(--warning-color); }
  .bg-danger { background-color: var(--danger-color); }
  .bg-info { background-color: var(--info-color); }

  /* Responsive utilities */
  @media (max-width: 576px) {
    .d-sm-none { display: none; }
    .d-sm-block { display: block; }
    .d-sm-inline-block { display: inline-block; }
    .d-sm-flex { display: flex; }
  }

  @media (max-width: 768px) {
    .d-md-none { display: none; }
    .d-md-block { display: block; }
    .d-md-inline-block { display: inline-block; }
    .d-md-flex { display: flex; }
  }

  @media (max-width: 992px) {
    .d-lg-none { display: none; }
    .d-lg-block { display: block; }
    .d-lg-inline-block { display: inline-block; }
    .d-lg-flex { display: flex; }
  }

  /* Accessibility */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Print styles */
  @media print {
    body {
      background-color: #fff;
      color: #000;
    }
    a {
      color: #000;
    }
    .no-print {
      display: none !important;
    }
  }
`;

export default GlobalStyle;
