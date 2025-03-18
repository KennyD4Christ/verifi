import { createGlobalStyle } from 'styled-components';
import { normalize } from 'styled-normalize';

const GlobalStyle = createGlobalStyle`
  ${normalize}

  :root {
    --primary-color: #0645AD;
    --secondary-color: #043584;
    --text-color: #333;
    --background-color: #87CEEB;
    --success-color: #28a745;
    --warning-color: #ffc107;
    --danger-color: #dc3545;
    --info-color: #17a2b8;
    --font-family: 'Arial', sans-serif;
    --transition-speed: 0.3s;
    --header-height: 64px;
    --sidebar-width: 200px;
    --sidebar-collapsed-width: 80px;
    --card-background: #FFFFFF;
    --card-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    --border-radius: 8px;

    --breakpoint-sm: 576px;
    --breakpoint-md: 768px;
    --breakpoint-lg: 992px;
    --breakpoint-xl: 1200px;
  }

  .container {
    width: 100%;
    max-width: 100%;
    padding-right: max(15px, env(safe-area-inset-right));
    padding-left: max(15px, env(safe-area-inset-left));
    margin-right: auto;
    margin-left: auto;
    overflow-x: hidden;
  }

  @media (min-width: 576px) {
    .container {
      max-width: 540px;
    }
  }

  @media (min-width: 768px) {
    .container {
      max-width: 720px;
    }
  }

  @media (min-width: 992px) {
    .container {
      max-width: 960px;
    }
  }

  @media (min-width: 1200px) {
    .container {
      max-width: 1140px;
    }
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    margin-right: -15px;
    margin-left: -15px;
  }

  .col {
    position: relative;
    width: 100%;
    padding-right: 15px;
    padding-left: 15px;
  }

  /* Responsive columns */
  .col-12 { flex: 0 0 100%; max-width: 100%; }

  @media (min-width: 576px) {
    .col-sm-6 { flex: 0 0 50%; max-width: 50%; }
    .col-sm-4 { flex: 0 0 33.333333%; max-width: 33.333333%; }
    .col-sm-3 { flex: 0 0 25%; max-width: 25%; }
  }

  @media (min-width: 768px) {
    .col-md-6 { flex: 0 0 50%; max-width: 50%; }
    .col-md-4 { flex: 0 0 33.333333%; max-width: 33.333333%; }
    .col-md-3 { flex: 0 0 25%; max-width: 25%; }
  }

  /* Responsive Tables */
  .table-responsive {
    display: block;
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .main-content {
    margin-left: 0;
    transition: margin-left var(--transition-speed);
  }

  .main-content.sidebar-collapsed {
    margin-left: var(--sidebar-collapsed-width);
  }

  @media (min-width: 768px) {
    .main-content {
      margin-left: var(--sidebar-width);
    }

    .main-content.sidebar-collapsed {
      margin-left: var(--sidebar-collapsed-width);
    }
  }

  @media (min-width: 768px) {
    .main-content {
      margin-left: 0;
    }

    .sidebar {
      transform: translateX(-100%);
    }

    .sidebar.open {
      transform: translateX(0);
    }
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
    width: 100%;
    max-width: 100vw;
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
  @media (min-width: 576px) {
    .d-sm-none { display: none; }
    .d-sm-block { display: block; }
    .d-sm-inline-block { display: inline-block; }
    .d-sm-flex { display: flex; }
  }

  @media (min-width: 768px) {
    .d-md-none { display: none; }
    .d-md-block { display: block; }
    .d-md-inline-block { display: inline-block; }
    .d-md-flex { display: flex; }
  }

  @media (min-width: 992px) {
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

  .bg-gradient {
    background: linear-gradient(to bottom, var(--background-color), #ffffff);
  }

  .hero-section {
    min-height: calc(100vh - var(--header-height));
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2rem 1rem;
    position: relative;
    overflow: hidden;
  }

  .hero-bg {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-size: cover;
    background-position: center;
    filter: brightness(0.7);
    z-index: -1;
  }

  .hero-content {
    max-width: 800px;
    margin: 0 auto;
    color: #ffffff;
    z-index: 1;
  }

  .cta-button {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    text-align: center;
    text-decoration: none;
    color: #ffffff;
    background-color: var(--primary-color);
    border-radius: 4px;
    transition: background-color var(--transition-speed);

    &:hover {
      background-color: var(--secondary-color);
    }
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 2rem;
    padding: 2rem 0;
    width: 100%;
  }

  .feature-card {
    background-color: #ffffff;
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: transform var(--transition-speed);

    &:hover {
      transform: translateY(-5px);
    }
  }

  .testimonials-section {
    background-color: #f9f9f9;
    padding: 4rem 0;
  }

  .footer {
    background-color: #333;
    color: #ffffff;
    padding: 2rem 0;
  }

  /* Responsive adjustments */
  @media (min-width: 768px) {
    .hero-section {
      padding: 1rem;
    }

    .features-grid {
      grid-template-columns: 1fr;
    }
  }

  .text-blue-600 {
    color: #2563eb; /* Tailwind's blue-600 color */
  }

  .text-white {
    color: #ffffff;
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
    gap: 1rem;
    padding: 1rem;
    width: 100%;
    overflow-x: hidden;
  }

  @media (min-width: 768px) {
    .dashboard-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 992px) {
    .dashboard-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 768px) {
    html {
      font-size: 16px;
    }
  }

  /* Responsive spacing utilities */
  .p-responsive {
    padding: 0.5rem;
  }

  @media (min-width: 768px) {
    .p-responsive {
      padding: 1rem;
    }
  }

  @media (min-width: 992px) {
    .p-responsive {
      padding: 1.5rem;
    }
  }

  .dashboard-card {
    background-color: var(--card-background);
    border-radius: var(--border-radius);
    box-shadow: var(--card-shadow);
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .dashboard-chart {
    width: 100%;
    height: 300px;
    margin-bottom: 1.5rem;
  }

  .dashboard-select {
    width: 100%;
    padding: 0.5rem;
    margin-bottom: 1rem;
    border: 1px solid #ddd;
    border-radius: var(--border-radius);
    background-color: var(--card-background);
  }

  .dashboard-search {
    width: 100%;
    padding: 0.5rem;
    margin-bottom: 1rem;
    border: 1px solid #ddd;
    border-radius: var(--border-radius);
  }

  .dashboard-button {
    padding: 0.5rem 1rem;
    background-color: var(--primary-color);
    color: #FFFFFF;
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: background-color var(--transition-speed);

    &:hover {
      background-color: var(--secondary-color);
    }
  }

  /* Responsive improvements */
  @media (max-width: 767px) {
    .dashboard-card,
    .feature-card {
      margin-right: -15px;
      margin-left: -15px;
      border-radius: 0;
    }
  }

  /* Content wrapping improvements */
  .dashboard-chart,
  .hero-content,
  .feature-card {
    max-width: 100%;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  /* Responsive adjustments for dashboard */
  @media (min-width: 768px) {
    .dashboard-chart {
      height: 200px;
    }

    .dashboard-card {
      padding: 1rem;
    }
  }
`;

export default GlobalStyle;
