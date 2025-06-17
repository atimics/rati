-- The Oracle Council Process
-- State: A list of Oracle wallet addresses and a record of proposals.
-- Actions:
-- 1. Ping: Anyone can submit a proposal for review.
-- 2. Ratify: An authorized Oracle can ratify a proposal.
-- 3. Get-Community-Status: Return current community status for avatar context
-- 4. Get-Recent-Proposals: Return recent proposals with status
-- 5. Get-Agent-Process-List: Return curated list of agent processes for updates

Oracles = Oracles or {} -- List of Arweave wallet addresses
Proposals = Proposals or {} -- Table to store proposals by ID
AgentProcessList = AgentProcessList or {} -- Curated list of agent processes
CommunityStats = CommunityStats or {
  activeProposals = 0,
  totalRatified = 0,
  lastActivity = 0
}

-- Handler for proposal submission
Handlers.add(
  "ping",
  Handlers.utils.hasMatchingTag("Action", "Ping"),
  function (msg)
    local proposalId = msg.id
    local proposer = msg.owner
    Proposals[proposalId] = {
      content = msg.Data,
      proposer = proposer,
      ratifications = {},
      status = "pending",
      timestamp = msg.Timestamp,
      category = msg.Tags.Category or "general",
      title = msg.Tags.Title or "Untitled Proposal"
    }
    
    -- Update community stats
    CommunityStats.activeProposals = CommunityStats.activeProposals + 1
    CommunityStats.lastActivity = msg.Timestamp
    
    ao.send({
      Target = msg.From,
      Data = "Proposal " .. proposalId .. " has been received by the Oracle Council."
    })
  end
)

-- Handler for proposal ratification
Handlers.add(
  "ratify",
  Handlers.utils.hasMatchingTag("Action", "Ratify"),
  function (msg)
    local oracleAddress = msg.owner
    local proposalId = msg.Tags.ProposalId

    -- Check if the sender is an authorized Oracle
    local isOracle = false
    for _, addr in ipairs(Oracles) do
      if addr == oracleAddress then
        isOracle = true
        break
      end
    end

    if not isOracle then
      ao.send({ Target = msg.From, Data = "Error: You are not an authorized Oracle." })
      return
    end

    if Proposals[proposalId] then
      Proposals[proposalId].ratifications = Proposals[proposalId].ratifications or {}
      Proposals[proposalId].ratifications[oracleAddress] = true
      
      -- Check if quorum is met (e.g., > 50% of oracles)
      local ratificationCount = 0
      for _ in pairs(Proposals[proposalId].ratifications) do 
        ratificationCount = ratificationCount + 1 
      end

      if ratificationCount >= (#Oracles / 2) then
        Proposals[proposalId].status = "ratified"
        
        -- Update community stats
        CommunityStats.activeProposals = CommunityStats.activeProposals - 1
        CommunityStats.totalRatified = CommunityStats.totalRatified + 1
        CommunityStats.lastActivity = msg.Timestamp
        
        -- Announce the ratification to the network
        ao.send({
          Target = ao.PROCESS, -- Broadcast to subscribers
          Data = "Proposal " .. proposalId .. " has been ratified by the Oracle Council.",
          Tags = { 
            Type = "Announcement", 
            Status = "Ratified", 
            ProposalId = proposalId,
            Category = Proposals[proposalId].category
          }
        })
      end
    else
      ao.send({ Target = msg.From, Data = "Error: Proposal not found." })
    end
  end
)

-- Handler for community status queries
Handlers.add(
  "get-community-status",
  Handlers.utils.hasMatchingTag("Action", "Get-Community-Status"),
  function (msg)
    local currentTime = msg.Timestamp or os.time()
    local timeSinceActivity = currentTime - (CommunityStats.lastActivity or 0)
    
    local activityLevel = "quiet"
    if timeSinceActivity < 3600 then -- 1 hour
      activityLevel = "active"
    elseif timeSinceActivity < 86400 then -- 24 hours
      activityLevel = "moderate"
    end
    
    local consensusHealth = "stable"
    if CommunityStats.activeProposals > 10 then
      consensusHealth = "busy"
    elseif CommunityStats.activeProposals == 0 then
      consensusHealth = "quiet"
    end
    
    local status = {
      activeProposals = CommunityStats.activeProposals,
      totalRatified = CommunityStats.totalRatified,
      recentActivity = activityLevel,
      consensusHealth = consensusHealth,
      communityMood = activityLevel == "active" and "engaged" or "contemplative",
      oracleCount = #Oracles,
      lastUpdate = currentTime
    }
    
    ao.send({
      Target = msg.From,
      Data = json.encode(status)
    })
  end
)

-- Handler for recent proposals query
Handlers.add(
  "get-recent-proposals",
  Handlers.utils.hasMatchingTag("Action", "Get-Recent-Proposals"),
  function (msg)
    local limit = tonumber(msg.Tags.Limit) or 10
    local statusFilter = msg.Tags.Status or "all"
    local proposals = {}
    local count = 0
    
    -- Collect recent proposals (simplified - would need proper sorting by timestamp)
    for id, proposal in pairs(Proposals) do
      if count >= limit then break end
      if statusFilter == "all" or proposal.status == statusFilter then
        table.insert(proposals, {
          id = id,
          title = proposal.title,
          category = proposal.category,
          status = proposal.status,
          timestamp = proposal.timestamp,
          ratificationCount = proposal.ratifications and 
            (function() 
              local c = 0
              for _ in pairs(proposal.ratifications) do c = c + 1 end
              return c
            end)() or 0
        })
        count = count + 1
      end
    end
    
    ao.send({
      Target = msg.From,
      Data = json.encode(proposals)
    })
  end
)

-- Handler for agent process list management
Handlers.add(
  "update-agent-list",
  Handlers.utils.hasMatchingTag("Action", "Update-Agent-List"),
  function (msg)
    local oracleAddress = msg.owner
    
    -- Check if sender is authorized oracle
    local isOracle = false
    for _, addr in ipairs(Oracles) do
      if addr == oracleAddress then
        isOracle = true
        break
      end
    end
    
    if not isOracle then
      ao.send({ Target = msg.From, Data = "Error: You are not an authorized Oracle." })
      return
    end
    
    -- Update agent process list
    local newList = json.decode(msg.Data)
    if newList and type(newList) == "table" then
      AgentProcessList = newList
      ao.send({
        Target = msg.From,
        Data = "Agent process list updated successfully. Total agents: " .. #AgentProcessList
      })
    else
      ao.send({
        Target = msg.From,
        Data = "Error: Invalid agent list format"
      })
    end
  end
)

-- Handler for getting agent process list
Handlers.add(
  "get-agent-list",
  Handlers.utils.hasMatchingTag("Action", "Get-Agent-Process-List"),
  function (msg)
    local response = {
      processes = AgentProcessList,
      totalCount = #AgentProcessList,
      lastUpdate = CommunityStats.lastActivity
    }
    
    ao.send({
      Target = msg.From,
      Data = json.encode(response)
    })
  end
)
