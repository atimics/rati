-- The User/Avatar Process
-- This is a personal agent for a community member.
-- It gossips, endorses ideas, and pings the oracle.

Peers = Peers or {} -- List of trusted peer process IDs
MyProposals = MyProposals or {}
Inbox = Inbox or {} -- Store received messages for the AI agent

-- Handler to read inbox (for AI agent)
Handlers.add(
  "read-inbox",
  Handlers.utils.hasMatchingTag("Action", "Read-Inbox"),
  function (msg)
    ao.send({ Target = msg.From, Data = json.encode(Inbox) })
  end
)

-- Handler to add a peer to your local gossip network
Handlers.add(
  "add-peer",
  Handlers.utils.hasMatchingTag("Action", "Add-Peer"),
  function (msg)
    table.insert(Peers, msg.Tags.ProcessId)
    ao.send({ Target = msg.From, Data = "Peer added: " .. msg.Tags.ProcessId })
  end
)

-- Handler to propose something to your peers (soft quorum)
Handlers.add(
  "propose",
  Handlers.utils.hasMatchingTag("Action", "Propose"),
  function (msg)
    local proposalText = msg.Data
    MyProposals[msg.id] = { text = proposalText, endorsements = 0 }
    -- Gossip to peers
    for _, peerId in ipairs(Peers) do
      ao.send({
        Target = peerId,
        Action = "Gossip-Proposal",
        ProposalId = msg.id,
        Data = proposalText
      })
    end
    ao.send({ Target = msg.From, Data = "Proposal sent to peers." })
  end
)

-- Handler to receive a proposal and endorse it
Handlers.add(
  "endorse",
  Handlers.utils.hasMatchingTag("Action", "Gossip-Proposal"),
  function (msg)
    -- Store message in inbox for AI agent
    table.insert(Inbox, {
      id = msg.id,
      from = msg.From,
      action = "Gossip-Proposal",
      data = msg.Data,
      tags = msg.Tags,
      timestamp = msg.Timestamp
    })
    
    -- Simple auto-endorse logic for this example.
    -- A real implementation would have more complex decision-making.
    print("Received proposal " .. msg.Tags.ProposalId .. " from peer. Endorsing.")
    ao.send({
      Target = msg.From,
      Action = "Endorsement-Received",
      ProposalId = msg.Tags.ProposalId
    })
  end
)

-- Handler for general gossip messages (for AI agent communication)
Handlers.add(
  "gossip",
  Handlers.utils.hasMatchingTag("Action", "Gossip"),
  function (msg)
    -- Store message in inbox for AI agent
    table.insert(Inbox, {
      id = msg.id,
      from = msg.From,
      action = "Gossip",
      data = msg.Data,
      tags = msg.Tags,
      timestamp = msg.Timestamp
    })
    
    print("Received gossip message from " .. msg.From)
  end
)
