import React, { useState } from 'react';
import './MarkdownHelper.css';

const MarkdownHelper = ({ onInsert }) => {
  const [isOpen, setIsOpen] = useState(false);

  const markdownExamples = [
    {
      category: 'Text Formatting',
      items: [
        { name: 'Bold', syntax: '**bold text**', description: 'Make text bold' },
        { name: 'Italic', syntax: '*italic text*', description: 'Make text italic' },
        { name: 'Strikethrough', syntax: '~~strikethrough~~', description: 'Cross out text' },
        { name: 'Inline Code', syntax: '`code`', description: 'Highlight code inline' },
        { name: 'Highlight', syntax: '==highlighted==', description: 'Highlight text' }
      ]
    },
    {
      category: 'Headers',
      items: [
        { name: 'Header 1', syntax: '# Header 1', description: 'Largest header' },
        { name: 'Header 2', syntax: '## Header 2', description: 'Sub header' },
        { name: 'Header 3', syntax: '### Header 3', description: 'Small header' }
      ]
    },
    {
      category: 'Lists',
      items: [
        { name: 'Bullet List', syntax: '- Item 1\n- Item 2', description: 'Unordered list' },
        { name: 'Numbered List', syntax: '1. Item 1\n2. Item 2', description: 'Ordered list' },
        { name: 'Task List', syntax: '- [ ] Todo\n- [x] Done', description: 'Checkable items' }
      ]
    },
    {
      category: 'Code & Quotes',
      items: [
        { name: 'Code Block', syntax: '```javascript\nconst x = 1;\n```', description: 'Multi-line code with syntax highlighting' },
        { name: 'Quote', syntax: '> This is a quote', description: 'Block quote' }
      ]
    },
    {
      category: 'Links & Media',
      items: [
        { name: 'Link', syntax: '[Link Text](https://example.com)', description: 'Clickable link' },
        { name: 'Image', syntax: '![Alt Text](image-url)', description: 'Display image' }
      ]
    },
    {
      category: 'Tables',
      items: [
        { 
          name: 'Table', 
          syntax: '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |', 
          description: 'Create data table' 
        }
      ]
    }
  ];

  const handleInsert = (syntax) => {
    if (onInsert) {
      onInsert(syntax);
    }
    setIsOpen(false);
  };

  return (
    <div className="markdown-helper">
      <button 
        className="markdown-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Markdown formatting help"
      >
        📝
      </button>
      
      {isOpen && (
        <div className="markdown-panel">
          <div className="markdown-header">
            <h3>Markdown Formatting</h3>
            <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
          </div>
          
          <div className="markdown-content">
            {markdownExamples.map((category, idx) => (
              <div key={idx} className="markdown-category">
                <h4>{category.category}</h4>
                <div className="markdown-items">
                  {category.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="markdown-item">
                      <div className="item-header">
                        <span className="item-name">{item.name}</span>
                        <button 
                          className="insert-btn"
                          onClick={() => handleInsert(item.syntax)}
                          title="Insert into message"
                        >
                          +
                        </button>
                      </div>
                      <code className="item-syntax">{item.syntax}</code>
                      <p className="item-description">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <div className="markdown-footer">
            <p>💡 <strong>Tip:</strong> You can combine multiple formatting options!</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkdownHelper;
