-- The Oracle Council Process
-- State: A list of Oracle wallet addresses and a record of proposals.
-- Actions:
-- 1. Ping: Anyone can submit a proposal for review.
-- 2. Ratify: An authorized Oracle can ratify a proposal.

Oracles = Oracles or {} -- List of Arweave wallet addresses
Proposals = Proposals or {} -- Table to store proposals by ID

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
      status = "pending"
    }
    ao.send({
      Target = msg.From,
      Data = "Proposal " .. proposalId .. " has been received by the Oracle Council."
    })
  end
)

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
      for _ in pairs(Proposals[proposalId].ratifications) do ratificationCount = ratificationCount + 1 end

      if ratificationCount >= (#Oracles / 2) then
        Proposals[proposalId].status = "ratified"
        -- Announce the ratification to the network
        ao.send({
          Target = ao.PROCESS, -- Broadcast to subscribers
          Data = "Proposal " .. proposalId .. " has been ratified by the Oracle Council.",
          Tags = { Type = "Announcement", Status = "Ratified", ProposalId = proposalId }
        })
      end
    else
      ao.send({ Target = msg.From, Data = "Error: Proposal not found." })
    end
  end
)
