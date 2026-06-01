import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/modules.css';
import './styles/content.css';
import './styles/quiz.css';
import './styles/flashcards.css';
import './styles/responsive.css';
import './styles/print.css';
import './styles/ai.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
