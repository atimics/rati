import React, { useEffect, useState, useCallback } from 'react';
import MemoryService from '../services/MemoryService';

/**
 * Auto Memory Processor Component
 * 
 * Automatically processes chat messages into memories when certain thresholds are met.
 * This runs in the background to make the memory system more seamless.
 */
const AutoMemoryProcessor = ({ agentId, chatHistory, onMemoryProcessed }) => {
  const [processingStatus, setProcessingStatus] = useState('idle');
  const [lastProcessedCount, setLastProcessedCount] = useState(0);

  useEffect(() => {
    if (!agentId || !chatHistory || chatHistory.length === 0) return;

    // Auto-process when we have new messages
    const shouldAutoProcess = () => {
      const newMessageCount = chatHistory.length - lastProcessedCount;
      
      // Process if:
      // 1. We have 10+ new messages since last processing
      // 2. OR it's been 30+ minutes since last message and we have 5+ new messages
      const lastMessage = chatHistory[chatHistory.length - 1];
      const timeSinceLastMessage = lastMessage ? Date.now() - new Date(lastMessage.timestamp).getTime() : 0;
      const thirtyMinutes = 30 * 60 * 1000;

      return (newMessageCount >= 10) || 
             (newMessageCount >= 5 && timeSinceLastMessage > thirtyMinutes);
    };

    if (shouldAutoProcess()) {
      processNewMemories();
    }
  }, [agentId, chatHistory, processNewMemories, lastProcessedCount]);

  const processNewMemories = useCallback(async () => {
    if (processingStatus === 'processing') return;

    try {
      setProcessingStatus('processing');
      
      // Get unprocessed messages
      const unprocessedMessages = chatHistory.slice(lastProcessedCount);
      
      // Group into conversation chunks (similar to AgentMemoryView logic)
      const chunks = groupMessagesIntoConversations(unprocessedMessages);
      
      let processedCount = 0;
      for (const chunk of chunks) {
        try {
          const result = await MemoryService.processConversationIntoMemory(agentId, chunk);
          if (result.success) {
            processedCount++;
          }
        } catch (err) {
          console.error('AutoMemoryProcessor: Failed to process chunk:', err);
        }
      }

      setLastProcessedCount(chatHistory.length);
      setProcessingStatus('completed');
      
      if (onMemoryProcessed && processedCount > 0) {
        onMemoryProcessed(processedCount);
      }

      console.log(`AutoMemoryProcessor: Processed ${processedCount} conversation chunks into memories`);
      
    } catch (error) {
      console.error('AutoMemoryProcessor: Processing failed:', error);
      setProcessingStatus('error');
    } finally {
      // Reset status after 5 seconds
      setTimeout(() => setProcessingStatus('idle'), 5000);
    }
  }, [agentId, chatHistory, lastProcessedCount, processingStatus, onMemoryProcessed]);

  const groupMessagesIntoConversations = (messages) => {
    const chunks = [];
    let currentChunk = [];
    let lastMessageTime = null;

    messages.forEach((message) => {
      const messageTime = new Date(message.timestamp || Date.now());
      
      // If more than 30 minutes between messages, start new conversation
      if (lastMessageTime && (messageTime - lastMessageTime) > 30 * 60 * 1000) {
        if (currentChunk.length > 0) {
          chunks.push([...currentChunk]);
          currentChunk = [];
        }
      }
      
      currentChunk.push(message);
      lastMessageTime = messageTime;
      
      // If chunk gets too large (15+ messages), close it
      if (currentChunk.length >= 15) {
        chunks.push([...currentChunk]);
        currentChunk = [];
      }
    });
    
    // Add final chunk if it has content
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks.filter(chunk => chunk.length >= 2); // Only keep conversations with at least 2 messages
  };

  // Only render status indicator if actively processing
  if (processingStatus === 'idle') return null;

  return (
    <div className="auto-memory-processor">
      <div className={`memory-status ${processingStatus}`}>
        {processingStatus === 'processing' && (
          <>
            <span className="status-icon">🧠</span>
            <span className="status-text">Processing memories...</span>
          </>
        )}
        {processingStatus === 'completed' && (
          <>
            <span className="status-icon">✅</span>
            <span className="status-text">Memories updated</span>
          </>
        )}
        {processingStatus === 'error' && (
          <>
            <span className="status-icon">❌</span>
            <span className="status-text">Memory processing failed</span>
          </>
        )}
      </div>
      
      <style jsx>{`
        .auto-memory-processor {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 1000;
        }
        
        .memory-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }
        
        .memory-status.processing {
          background: rgba(74, 144, 226, 0.9);
          color: white;
        }
        
        .memory-status.completed {
          background: rgba(34, 197, 94, 0.9);
          color: white;
        }
        
        .memory-status.error {
          background: rgba(239, 68, 68, 0.9);
          color: white;
        }
        
        .status-icon {
          font-size: 16px;
        }
        
        .status-text {
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
};

export default AutoMemoryProcessor;
