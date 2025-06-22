import React from 'react';
import { Toaster } from 'react-hot-toast';
import { WalletProvider } from './contexts/WalletProvider';
import { AOProvider } from './contexts/AOProvider';
import ModernApp from './components/ModernApp';
import './App.css';

/**
 * Root App Component - Modernized with AO Integration
 * 
 * Provides wallet and AO context providers for the entire application,
 * enabling seamless blockchain integration throughout the component tree.
 */

function App() {
  return (
    <WalletProvider>
      <AOProvider>
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
      </AOProvider>
    </WalletProvider>
  );
}

export default App;
