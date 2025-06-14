-- The Oracle Council Process
-- State: A list of Oracle wallet addresses and a record of proposals.
-- Actions:
-- 1. Ping: Anyone can submit a proposal for review.
-- 2. Bless: An authorized Oracle can ratify a proposal.

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
      blessings = {},
      status = "pending"
    }
    ao.send({
      Target = msg.From,
      Data = "Proposal " .. proposalId .. " has been received by the Oracle Council."
    })
  end
)

Handlers.add(
  "bless",
  Handlers.utils.hasMatchingTag("Action", "Bless"),
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
      Proposals[proposalId].blessings[oracleAddress] = true
      -- Check if quorum is met (e.g., > 50% of oracles)
      local blessingCount = 0
      for _ in pairs(Proposals[proposalId].blessings) do blessingCount = blessingCount + 1 end

      if blessingCount >= (#Oracles / 2) then
        Proposals[proposalId].status = "blessed"
        -- Announce the blessing to the network
        ao.send({
          Target = ao.PROCESS, -- Broadcast to subscribers
          Data = "Proposal " .. proposalId .. " has been blessed by the Oracle Council.",
          Tags = { Type = "Announcement", Status = "Blessed", ProposalId = proposalId }
        })
      end
    else
      ao.send({ Target = msg.From, Data = "Error: Proposal not found." })
    end
  end
)
