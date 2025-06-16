# RATi Frontend

The RATi frontend is a React-based user interface for interacting with decentralized digital avatars. It provides a modern, responsive interface for creating, configuring, and chatting with AI-powered avatars that have persistent memory on the Arweave blockchain.

## Features

- **Avatar Chat Interface**: Real-time communication with AI avatars
- **Avatar Configuration**: Set up and customize digital avatars
- **Deployment Management**: Deploy and manage avatar processes
- **Real-time Updates**: WebSocket integration for live updates
- **Responsive Design**: Mobile-friendly interface

## Technology Stack

- **React 19**: Modern React with latest features
- **Vite**: Fast build tool and dev server
- **CSS3**: Modern styling with CSS Grid and Flexbox
- **WebSockets**: Real-time communication
- **Fetch API**: HTTP requests to backend services

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Development

The frontend runs on `http://localhost:5173` by default and connects to:
- Deployment Service: `http://localhost:3001`
- WebSocket connections for real-time features

### Key Components

- **App.jsx**: Main application component with routing
- **ChatInterface.jsx**: Chat interface for avatar communication
- **ConfigInterface.jsx**: Avatar configuration and setup
- **components/**: Reusable UI components

### API Integration

The frontend communicates with the deployment service through:
- REST API endpoints for avatar management
- WebSocket connections for real-time chat
- Real-time status updates for deployments

### Build and Deployment

```bash
# Production build
npm run build

# The build output is in the 'dist' directory
# Serve with any static file server
```

## Contributing

Please read the main project [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.

## License

See the main project [LICENSE](../LICENSE) file.+ Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuRATion

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
