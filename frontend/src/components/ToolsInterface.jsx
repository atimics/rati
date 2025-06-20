import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import AgentToolsService from '../services/AgentToolsService';
import './ToolsInterface.css';

/**
 * Tools Interface Component
 * 
 * Provides access to agent tools and utilities
 */

const ToolsInterface = () => {
  const { isConnected } = useWallet();
  const [selectedTool, setSelectedTool] = useState(null);
  const [toolResult, setToolResult] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [toolInputs, setToolInputs] = useState({});

  // Define available tools explicitly to avoid object rendering issues
  const availableTools = [
    {
      id: 'writeJournalEntry',
      name: 'Write Journal Entry',
      description: 'Write a permanent journal entry to Arweave',
      parameters: {
        content: { type: 'string', description: 'The journal entry content', required: true },
        entryType: { type: 'string', description: 'Type of entry (reflection, oracle-scroll, etc.)', default: 'reflection' }
      }
    },
    {
      id: 'createOracleProposal',
      name: 'Create Oracle Proposal',
      description: 'Create a governance proposal for the oracle network',
      parameters: {
        proposalType: { type: 'string', description: 'Type of proposal (governance, consensus, etc.)', required: true },
        title: { type: 'string', description: 'Proposal title', required: true },
        description: { type: 'string', description: 'Detailed description', required: true },
        data: { type: 'object', description: 'Proposal data' }
      }
    }
  ];

  const handleToolSelect = (tool) => {
    setSelectedTool(tool);
    setToolResult(null);
    // Initialize inputs for this tool
    const inputs = {};
    Object.keys(tool.parameters).forEach(param => {
      inputs[param] = tool.parameters[param].default || '';
    });
    setToolInputs(inputs);
  };

  const handleInputChange = (paramName, value) => {
    setToolInputs(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const handleExecuteTool = async () => {
    if (!selectedTool) return;

    setIsExecuting(true);
    setToolResult(null);

    try {
      // Prepare the context with agentId and tool inputs
      const context = {
        agentId: 'rati-default-agent-123',
        ...toolInputs
      };

      let result;
      if (selectedTool.id === 'writeJournalEntry') {
        result = await AgentToolsService.writeJournalEntry(context);
      } else if (selectedTool.id === 'createOracleProposal') {
        result = await AgentToolsService.createOracleProposal(context);
      } else {
        throw new Error(`Unknown tool: ${selectedTool.id}`);
      }

      setToolResult(result);
    } catch (error) {
      setToolResult({
        success: false,
        error: error.message,
        message: `Failed to execute ${selectedTool.name}`
      });
    } finally {
      setIsExecuting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="tools-interface">
        <div className="tools-header">
          <h2>🛠️ Agent Tools</h2>
          <p>Connect your wallet to access agent tools</p>
        </div>
        <div className="wallet-required">
          <div className="wallet-prompt">
            <span className="wallet-icon">🔒</span>
            <div className="wallet-message">
              <h3>Wallet Connection Required</h3>
              <p>Please connect your ArConnect wallet to use agent tools.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tools-interface">
      <div className="tools-header">
        <h2>🛠️ Agent Tools</h2>
        <p>Execute tools to interact with your digital avatar</p>
      </div>

      <div className="tools-content">
        <div className="tools-sidebar">
          <h3>Available Tools</h3>
          <div className="tools-list">
            {availableTools.map((tool) => (
              <button
                key={tool.id}
                className={`tool-item ${selectedTool?.id === tool.id ? 'active' : ''}`}
                onClick={() => handleToolSelect(tool)}
              >
                <div className="tool-name">{tool.name}</div>
                <div className="tool-description">{tool.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="tools-main">
          {selectedTool ? (
            <div className="tool-executor">
              <div className="tool-header">
                <h3>{selectedTool.name}</h3>
                <p>{selectedTool.description}</p>
              </div>

              <div className="tool-parameters">
                <h4>Parameters</h4>
                {Object.entries(selectedTool.parameters).map(([paramName, paramConfig]) => (
                  <div key={paramName} className="parameter-input">
                    <label htmlFor={paramName}>
                      {paramName}
                      {paramConfig.required && <span className="required">*</span>}
                    </label>
                    <div className="parameter-description">{paramConfig.description}</div>
                    {paramConfig.type === 'string' && paramName !== 'data' ? (
                      <textarea
                        id={paramName}
                        value={toolInputs[paramName] || ''}
                        onChange={(e) => handleInputChange(paramName, e.target.value)}
                        placeholder={`Enter ${paramName}...`}
                        rows={paramName === 'content' || paramName === 'description' ? 6 : 2}
                      />
                    ) : (
                      <textarea
                        id={paramName}
                        value={typeof toolInputs[paramName] === 'object' 
                          ? JSON.stringify(toolInputs[paramName], null, 2) 
                          : toolInputs[paramName] || ''}
                        onChange={(e) => {
                          let value = e.target.value;
                          if (paramConfig.type === 'object') {
                            try {
                              value = JSON.parse(value);
                            } catch {
                              value = e.target.value; // Keep as string if invalid JSON
                            }
                          }
                          handleInputChange(paramName, value);
                        }}
                        placeholder={paramConfig.type === 'object' ? 'Enter JSON object...' : `Enter ${paramName}...`}
                        rows={4}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="tool-actions">
                <button
                  className="execute-button"
                  onClick={handleExecuteTool}
                  disabled={isExecuting}
                >
                  {isExecuting ? (
                    <>
                      <span className="spinner">⏳</span>
                      Executing...
                    </>
                  ) : (
                    <>
                      <span className="execute-icon">▶️</span>
                      Execute Tool
                    </>
                  )}
                </button>
              </div>

              {toolResult && (
                <div className={`tool-result ${toolResult.success ? 'success' : 'error'}`}>
                  <h4>Result</h4>
                  <div className="result-message">{toolResult.message}</div>
                  {toolResult.success && toolResult.arweaveUrl && (
                    <div className="result-links">
                      <a href={toolResult.arweaveUrl} target="_blank" rel="noopener noreferrer">
                        View on Arweave
                      </a>
                      {toolResult.viewBlockUrl && (
                        <a href={toolResult.viewBlockUrl} target="_blank" rel="noopener noreferrer">
                          View on ViewBlock
                      </a>
                      )}
                    </div>
                  )}
                  {toolResult.error && (
                    <div className="result-error">
                      <strong>Error:</strong> {toolResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="tool-placeholder">
              <h3>Select a Tool</h3>
              <p>Choose a tool from the sidebar to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ToolsInterface;
