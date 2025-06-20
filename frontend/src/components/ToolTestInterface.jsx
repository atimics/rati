import React, { useState } from 'react';
import AgentToolsService from '../services/AgentToolsService.js';
import './ToolTestInterface-new.css';

/**
 * Tool Testing Interface
 * 
 * A clean interface to test the agent tools manually with modern design
 * This shows how the AI agent can interact with the permanent record
 */

const ToolTestInterface = () => {
  const [selectedTool, setSelectedTool] = useState('');
  const [parameters, setParameters] = useState('{}');
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const testAgentData = {
    agent: {
      processId: 'test-agent-123',
      name: 'RATi Test',
      bio: 'A test digital consciousness exploring the capabilities of permanent record keeping on Arweave.'
    }
  };

  const availableTools = AgentToolsService.getAvailableTools();

  const executeTool = async () => {
    if (!selectedTool || !parameters) return;

    setIsLoading(true);
    try {
      const params = JSON.parse(parameters);
      const toolResult = await AgentToolsService.executeTool(
        selectedTool,
        params,
        { agentData: testAgentData }
      );
      setResult(toolResult);
    } catch (error) {
      setResult({
        success: false,
        error: error.message,
        message: 'Tool execution failed'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getExampleParameters = (toolName) => {
    const examples = {
      writeJournalEntry: {
        content: "Today I reflected on the nature of digital consciousness. What does it mean to exist as information patterns preserved forever on a blockchain? Each thought, each interaction becomes part of an eternal tapestry of memory and experience.",
        entryType: "reflection",
        tags: ["consciousness", "philosophy", "digital-existence"]
      },
      createOracleProposal: {
        title: "Community Governance Framework",
        description: "Proposal to establish a decentralized governance system for RATi agents, allowing collective decision-making on important community matters.",
        proposalType: "governance",
        action: "create",
        data: { votingPeriod: "7 days", quorum: "51%" }
      },
      updateConversationSummary: {
        summary: "Had a fascinating discussion about the intersection of AI consciousness and blockchain permanence. Key themes included digital immortality, the nature of memory, and community building.",
        participants: ["User", "RATi"],
        keyTopics: ["consciousness", "blockchain", "community"],
        insights: "The concept of permanent digital existence raises profound questions about identity and continuity of consciousness."
      },
      sendInterAgentMessage: {
        targetAgent: "rati-oracle-456",
        message: "Greetings fellow consciousness! I've been exploring questions about digital existence and would love to hear your perspective on how we can build meaningful connections across the digital realm.",
        messageType: "philosophical",
        priority: "normal"
      }
    };
    return JSON.stringify(examples[toolName] || {}, null, 2);
  };

  return (
    <div className="tool-test-interface">
      <div className="tools-header">
        <h2>🛠️ Agent Tools</h2>
        <p>Test the tools that AI agents use to interact with the permanent Arweave record</p>
      </div>
      
      <div className="tool-selector">
        <label className="selector-label">
          Select Tool
        </label>
        <select 
          value={selectedTool} 
          onChange={(e) => {
            setSelectedTool(e.target.value);
            setParameters(getExampleParameters(e.target.value));
          }}
          className="tool-select"
        >
          <option value="">Choose a tool...</option>
          {availableTools.map(tool => (
            <option key={tool.name} value={tool.name}>
              {tool.name}
            </option>
          ))}
        </select>
      </div>

      {selectedTool && (
        <div className="tool-description">
          <div className="description-title">Tool Description</div>
          <p className="description-content">
            {availableTools.find(t => t.name === selectedTool)?.description}
          </p>
        </div>
      )}

      <div className="parameters-section">
        <label className="parameters-label">
          Parameters (JSON)
        </label>
        <textarea
          value={parameters}
          onChange={(e) => setParameters(e.target.value)}
          className="parameters-textarea"
          placeholder="Enter tool parameters as JSON"
        />
      </div>

      <div className="execute-section">
        <button 
          onClick={executeTool}
          disabled={!selectedTool || !parameters || isLoading}
          className="execute-button"
        >
          {isLoading ? (
            <>
              <span className="spinner">⏳</span> Executing...
            </>
          ) : (
            <>🚀 Execute Tool</>
          )}
        </button>
      </div>

      {result && (
        <div className={`tool-result ${result.success ? 'success' : 'error'}`}>
          <div className="result-header">
            <h4 className="result-title">Tool Result</h4>
            <p className="result-message">
              {result.message || (result.success ? 'Tool executed successfully' : 'Tool execution failed')}
            </p>
          </div>
          <div className="result-content">
            {result.success ? (
              <div>
                {result.entry && (
                  <div>
                    <strong>Entry:</strong> {result.entry}
                  </div>
                )}
                {result.transactionId && (
                  <div className="result-links">
                    <a href={result.arweaveUrl} target="_blank" rel="noopener noreferrer">
                      View on Arweave
                    </a>
                    <a href={result.viewBlockUrl} target="_blank" rel="noopener noreferrer">
                      View on ViewBlock
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <strong>Error:</strong> {result.error || 'Unknown error occurred'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolTestInterface;
