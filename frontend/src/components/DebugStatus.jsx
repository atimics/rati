import React from 'react';

/**
 * Debug Status Component
 * Shows current state for debugging purposes
 */
const DebugStatus = ({ agentData, connectionStatus }) => {
  if (process.env.NODE_ENV === 'production') {
    return null; // Don't show in production
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <div><strong>Debug Status:</strong></div>
      <div>Agent Data: {agentData ? '✅ Available' : '❌ Missing'}</div>
      {agentData && (
        <div>Process ID: {agentData.agent?.processId?.slice(0, 12)}...</div>
      )}
      <div>Connection: {connectionStatus || 'Unknown'}</div>
    </div>
  );
};

export default DebugStatus;
