import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

// Only the development entry point. Application features are not implemented.
createRoot(document.getElementById('root')!).render(<StrictMode>{null}</StrictMode>);
