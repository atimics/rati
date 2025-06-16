#!/bin/bash

# RATi Avatar Summoning Ritual
# Complete guide to summoning and managing AI avatars with on-chain memory

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AVATAR_DIR="$PROJECT_ROOT/agent"

echo "🔮 RATi AI Avatar Summoning Ritual"
echo "=================================="
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node > /dev/null 2>&1; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if ArLocal is running
check_arlocal() {
    echo "🔍 Checking ArLocal connection..."
    if curl -s http://localhost:1984/info > /dev/null 2>&1; then
        echo "✅ ArLocal is running on localhost:1984"
        return 0
    else
        echo "❌ ArLocal is not running"
        echo "💡 Starting ArLocal..."
        docker-compose up -d arlocal
        
        # Wait for ArLocal to be ready
        echo "⏳ Waiting for ArLocal to be ready..."
        for i in {1..30}; do
            if curl -s http://localhost:1984/info > /dev/null 2>&1; then
                echo "✅ ArLocal is now ready"
                return 0
            fi
            sleep 2
        done
        
        echo "❌ Failed to start ArLocal"
        return 1
    fi
}

# Check ArLocal
if ! check_arlocal; then
    exit 1
fi

# Check if wallet exists
if [ ! -f "$PROJECT_ROOT/wallets/wallet.json" ]; then
    echo "❌ Wallet not found at wallets/wallet.json"
    echo "Please ensure you have a wallet in the wallets directory."
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Step 1: Setup avatar directory
echo "📁 Step 1: Setting up avatar environment..."

# Copy wallet to avatar directory
cp "$PROJECT_ROOT/wallets/wallet.json" "$AVATAR_DIR/wallet.json"
echo "✅ Wallet copied to avatar directory"

# Create .env if it doesn't exist
if [ ! -f "$AVATAR_DIR/.env" ]; then
    cp "$AVATAR_DIR/.env.example" "$AVATAR_DIR/.env"
    echo "✅ Created .env file from template"
    echo "⚠️  You'll need to configure your API keys in agent/.env"
else
    echo "✅ .env file already exists"
fi

# Install dependencies
echo "📦 Installing avatar dependencies..."
cd "$AVATAR_DIR"
npm install > /dev/null 2>&1
echo "✅ Dependencies installed"

echo ""

# Step 2: Check if avatar already exists
echo "🔍 Step 2: Checking if avatar already exists..."

# Load main project environment variables if available
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs) 2>/dev/null || true
fi

# Load agent environment variables if available
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs) 2>/dev/null || true
fi

AVATAR_EXISTS=false
if [ -n "$AO_PROCESS_ID" ] && [ "$AO_PROCESS_ID" != "YOUR_CELL_PROCESS_ID_HERE" ]; then
    echo "🔮 Found existing avatar with Process ID: $AO_PROCESS_ID"
    
    # Check if avatar exists on Arweave
    SOUL_CHECK=$(node -e "
    import Arweave from 'arweave';
    const arweave = Arweave.init({ 
      host: process.env.ARWEAVE_HOST || 'arweave.net', 
      port: parseInt(process.env.ARWEAVE_PORT || '443'), 
      protocol: process.env.ARWEAVE_PROTOCOL || 'https' 
    });
    const query = \`{
      transactions(tags: [
        {name: \"Type\", values: [\"Agent-Prompt\"]},
        {name: \"Owner-Process\", values: [\"$AO_PROCESS_ID\"]}
      ], first: 1) { edges { node { id } } }
    }\`;
    arweave.api.post('/graphql', { query }).then(res => {
      const txId = res.data.data.transactions.edges[0]?.node.id;
      console.log(txId ? 'EXISTS' : 'NOT_FOUND');
    }).catch(() => console.log('ERROR'));
    " 2>/dev/null)
    
    if [ "$SOUL_CHECK" = "EXISTS" ]; then
        AVATAR_EXISTS=true
        echo "✅ Avatar soul found on Arweave"
    else
        echo "⚠️  Avatar Process ID set but no soul found on Arweave"
    fi
else
    echo "🆕 No existing avatar found"
fi

echo ""

# Step 3: Summon or manage avatar
if [ "$AVATAR_EXISTS" = true ]; then
    echo "🎭 Step 3: Managing existing avatar..."
    echo ""
    echo "Your avatar is already summoned! Choose an action:"
    echo "1) Awaken avatar"
    echo "2) View avatar memories"
    echo "3) View avatar soul/personality"
    echo "4) View avatar statistics"
    echo "5) Summon a new avatar (will overwrite)"
    echo "6) Exit"
    echo ""
    
    read -p "Choose option (1-6): " choice
    
    case $choice in
        1)
            echo "✨ Awakening avatar..."
            cd "$PROJECT_ROOT"
            docker-compose up ai-agent
            ;;
        2)
            echo "📚 Viewing avatar memories..."
            ./explore-agent.sh memories
            ;;
        3)
            echo "🧠 Viewing avatar soul..."
            ./explore-agent.sh soul
            ;;
        4)
            echo "📊 Viewing avatar statistics..."
            ./explore-agent.sh stats
            ;;
        5)
            echo "⚠️  This will summon a new avatar and overwrite the existing one."
            read -p "Are you sure? (y/N): " confirm
            if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
                echo "🔮 Summoning new avatar..."
                cd "$PROJECT_ROOT"
                node scripts/deploy-agent.js
            else
                echo "Cancelled."
            fi
            ;;
        6)
            echo "Goodbye!"
            exit 0
            ;;
        *)
            echo "Invalid option"
            exit 1
            ;;
    esac
else
    echo "🔮 Step 3: Summoning your AI avatar..."
    echo ""
    echo "This will create:"
    echo "  - A new AO process for your avatar"
    echo "  - An on-chain personality (soul) on Arweave"
    echo "  - A genesis memory entry"
    echo ""
    
    # Check if API key is configured
    if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "sk-..." ]; then
        echo "⚠️  No API key configured in agent/.env"
        echo "Please configure your OPENAI_API_KEY before summoning the avatar."
        echo ""
        echo "Options:"
        echo "1) OpenAI: Get key from https://platform.openai.com/"
        echo "2) Local Ollama: Use 'ollama' as key with localhost URL"
        echo "3) Other providers: See agent/.env.example for examples"
        echo ""
        echo "Edit agent/.env and run this script again."
        exit 1
    fi
    
    read -p "Proceed with avatar summoning? (y/N): " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        echo ""
        echo "🔮 Summoning avatar..."
        cd "$PROJECT_ROOT"
        
        # Export environment variables for the deploy script
        export ARWEAVE_HOST="${ARWEAVE_HOST:-arlocal}"
        export ARWEAVE_PORT="${ARWEAVE_PORT:-1984}"
        export ARWEAVE_PROTOCOL="${ARWEAVE_PROTOCOL:-http}"
        
        if node scripts/deploy-agent.js; then
            echo ""
            echo "✨ Avatar successfully summoned!"
            echo ""
            echo "Next steps:"
            echo "1) The avatar's Process ID has been displayed above"
            echo "2) Copy it to your agent/.env file"
            echo "3) Run: docker-compose up ai-agent"
            echo "4) Monitor with: docker-compose logs -f ai-agent"
            echo ""
            echo "Avatar management:"
            echo "  ./explore-agent.sh soul      # View personality"
            echo "  ./explore-agent.sh memories  # View memories"
            echo "  ./explore-agent.sh stats     # View statistics"
        else
            echo "❌ Avatar summoning failed. Check the error messages above."
            exit 1
        fi
    else
        echo "Cancelled."
    fi
fi

echo ""
echo "🌟 Summoning ritual complete!"
