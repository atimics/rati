import React from 'react';
import { Toaster } from 'react-hot-toast';
import { WalletProvider } from './contexts/WalletProvider';
import ModernApp from './components/ModernApp';
import './App.css';

/**
 * Root App Component - Modernized
 * 
 * Now provides modern context providers and clean architecture
 * while maintaining compatibility with existing components.
 */

function App() {
  return (
    <WalletProvider>
      <div className="app">
        <ModernApp />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
              borderRadius: '10px',
            },
            success: {
              style: {
                background: '#4CAF50',
              },
            },
            error: {
              style: {
                background: '#f44336',
              },
            },
          }}
        />
      </div>
    </WalletProvider>
  );
}

export default App;
