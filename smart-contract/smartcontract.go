package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-chaincode-go/shim"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SmartContract provides functions for running an election
type SmartContract struct {
	contractapi.Contract
}

// Election data
type Election struct {
	Name           string                 `json:"name"`
	CandidateOne   string                 `json:"candidateOne"`
	CandidateTwo   string                 `json:"candidateTwo"`
	CandidateThree string                 `json:"candidateThree"`
	Organizer      string                 `json:"organizer"`
	PrivateVotes   map[string]PrivateVote `json:"privateVotes"`
	PublicVotes    map[string]PublicVote  `json:"publicVotes"`
	Winner         string                 `json:"winner"`
	NumOfVotes     int                    `json:"numVotes"`
	Status         string                 `json:"status"`
}

type PrivateVote struct {
	Hash string `json:"hash"`
}

type PublicVote struct {
	VoteFrom string `json:"voteFrom"`
	VoteTo   string `json:"voteTo"`
}

type Candidate struct {
	Name       string `json:"name"`
	NumOfVotes int    `json:"numVotes"`
}

// Query identity of invoker function
func (s *SmartContract) QueryIdentity(ctx contractapi.TransactionContextInterface) (string, error) {
	// Get encrypted client identity & decode it
	base64ID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("failed to read the ID: %v", err)
	}

	decodeID, err := base64.StdEncoding.DecodeString(base64ID)
	if err != nil {
		return "", fmt.Errorf("failed to decode the ID: %v", err)
	}

	// Output ID of transaction submitter
	client := string(decodeID)
	return client, nil
}

// Create Election function
func (s *SmartContract) CreateElection(
	ctx contractapi.TransactionContextInterface,
	electionName string, candidateOne string, candidateTwo string, candidateThree string,
) error {
	// Get encrypted client identity & decode it
	base64ID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("failed to read clientID: %v", err)
	}

	decodeID, err := base64.StdEncoding.DecodeString(base64ID)
	if err != nil {
		return fmt.Errorf("failed to base64 decode clientID: %v", err)
	}

	// get ID of submitting client
	client := string(decodeID)

	// Create an election
	privateVotes := make(map[string]PrivateVote)
	publicVotes := make(map[string]PublicVote)

	election := Election{
		Name:           electionName,
		CandidateOne:   candidateOne,
		CandidateTwo:   candidateTwo,
		CandidateThree: candidateThree,
		Organizer:      client,
		PrivateVotes:   privateVotes,
		PublicVotes:    publicVotes,
		Winner:         "",
		NumOfVotes:     0,
		Status:         "open",
	}

	electionJSON, err := json.Marshal(election)
	if err != nil {
		return err
	}

	// Store election in state
	err = ctx.GetStub().PutState(electionName, electionJSON)
	if err != nil {
		return fmt.Errorf("failed to put election in state: %v", err)
	}

	return nil
}

// Query election function
func (s *SmartContract) QueryElection(
	ctx contractapi.TransactionContextInterface, electionName string,
) (*Election, error) {
	// Get election JSON
	electionJSON, err := ctx.GetStub().GetState(electionName)
	if err != nil {
		return nil, fmt.Errorf("failed to get election %v: %v", electionName, err)
	}

	// Check if the election already exists.
	if electionJSON == nil {
		return nil, fmt.Errorf("election needs to already exist")
	}

	var election *Election
	err = json.Unmarshal(electionJSON, &election)

	if err != nil {
		return nil, err
	}

	return election, nil
}

// Adds the vote to private data collection of the peer
func (s *SmartContract) AddVote(ctx contractapi.TransactionContextInterface, electionName string) (string, error) {
	// Get vote arguments from transient map where it was stored on client-side
	transientMap, err := ctx.GetStub().GetTransient()
	if err != nil {
		return "", fmt.Errorf("error getting transient map: %v", err)
	}

	// If not found, the client did not pass along the parameters
	voteJSON, ok := transientMap["vote"]
	if !ok {
		return "", fmt.Errorf("error getting transient: %v", err)
	}

	// Create collection name using voter's organization ID
	clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return "", fmt.Errorf("failed to get verified MSPID: %v", err)
	}

	orgCollection := "_implicit_org_" + clientMSPID
	peerMSPID, err := shim.GetMSPID()
	if err != nil {
		return "", fmt.Errorf("failed getting the peer's MSPID: %v", err)
	}

	if clientMSPID != peerMSPID {
		return "", fmt.Errorf("client from org %v cannot store vote on peer from org %v", clientMSPID, peerMSPID)
	}

	// The transaction ID is a unique index for the vote
	transactionID := ctx.GetStub().GetTxID()

	// Create a composite key using the transaction ID & use it to store vote in private storage
	voteKey, err := ctx.GetStub().CreateCompositeKey("vote", []string{electionName, transactionID})
	if err != nil {
		return "", fmt.Errorf("failed to create composite key: %v", err)
	}

	err = ctx.GetStub().PutPrivateData(orgCollection, voteKey, voteJSON)
	if err != nil {
		return "", fmt.Errorf("failed to store vote in collection: %v", err)
	}

	// return the transaction ID so that the voter can query their vote
	return transactionID, nil
}

// Submits the vote to the election
func (s *SmartContract) SubmitVote(
	ctx contractapi.TransactionContextInterface, electionName string, transactionID string,
) error {
	//
	clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get client MSP ID: %v", err)
	}

	// get the election from public state
	election, err := s.QueryElection(ctx, electionName)
	if err != nil {
		return fmt.Errorf("failed to get election from state %v", err)
	}

	// check if election is open
	Status := election.Status
	if Status != "open" {
		return fmt.Errorf("election must be open to submit votes")
	}

	// Create implicit collection of voter org
	orgCollection := "_implicit_org_" + clientMSPID

	// Create composite vote key using the transaction ID inputted
	voteKey, err := ctx.GetStub().CreateCompositeKey("vote", []string{electionName, transactionID})
	if err != nil {
		return fmt.Errorf("failed to create composite key: %v", err)
	}

	// Get hash of the vote stored in private data
	voteHash, err := ctx.GetStub().GetPrivateDataHash(orgCollection, voteKey)
	if err != nil {
		return fmt.Errorf("failed to read hash from collection: %v", err)
	}

	if voteHash == nil {
		return fmt.Errorf("vote hash does not exist: %s", voteKey)
	}

	// Submit the hash of the private vote to the election
	Vote := PrivateVote{
		Hash: fmt.Sprintf("%x", voteHash),
	}

	votes := election.PrivateVotes
	votes[voteKey] = Vote
	election.PrivateVotes = votes

	newElectionJSON, _ := json.Marshal(election)

	// Update the election that is currently in state
	err = ctx.GetStub().PutState(electionName, newElectionJSON)
	if err != nil {
		return fmt.Errorf("failed to submit vote to election: %v", err)
	}

	return nil
}

// Query the vote submitted
func (s *SmartContract) QueryVote(
	ctx contractapi.TransactionContextInterface, electionName string, transactionID string,
) (*PublicVote, error) {
	// Verify that client org matches peer org
	clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return nil, fmt.Errorf("failed getting the client's MSPID: %v", err)
	}

	peerMSPID, err := shim.GetMSPID()
	if err != nil {
		return nil, fmt.Errorf("failed getting the peer's MSPID: %v", err)
	}

	if clientMSPID != peerMSPID {
		return nil, fmt.Errorf("client from org %v cannot access peer from org %v", clientMSPID, peerMSPID)
	}

	// Create the implicit collection
	orgCollection := "_implicit_org_" + clientMSPID

	// Use the composite key to retrieve the vote from private data
	voteKey, err := ctx.GetStub().CreateCompositeKey("vote", []string{electionName, transactionID})
	if err != nil {
		return nil, fmt.Errorf("failed to create composite key: %v", err)
	}

	voteJSON, err := ctx.GetStub().GetPrivateData(orgCollection, voteKey)
	if err != nil {
		return nil, fmt.Errorf("failed to get vote %v: %v", voteKey, err)
	}

	if voteJSON == nil {
		return nil, fmt.Errorf("vote %v does not exist", voteKey)
	}

	// Only the valid invoker can see the details of their vote
	var vote *PublicVote
	err = json.Unmarshal(voteJSON, &vote)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal voteJSON: %v", err)
	}

	// Get the client ID
	base64ID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return nil, fmt.Errorf("failed to read clientID: %v", err)
	}

	decodeID, err := base64.StdEncoding.DecodeString(base64ID)
	if err != nil {
		return nil, fmt.Errorf("failed to base64 decode clientID: %v", err)
	}

	client := string(decodeID)
	if client != vote.VoteFrom {
		return nil, fmt.Errorf("client id %v is not the owner %v of the bid", client, vote.VoteFrom)
	}

	return vote, nil
}

// Close the election
func (s *SmartContract) CloseElection(ctx contractapi.TransactionContextInterface, electionName string) error {
	// Get the election from public state
	election, err := s.QueryElection(ctx, electionName)
	if err != nil {
		return fmt.Errorf("failed to get election from state: %v", err)
	}

	// Confirm this was invoked by the organizer
	base64ID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("failed to read clientID: %v", err)
	}

	decodeID, err := base64.StdEncoding.DecodeString(base64ID)
	if err != nil {
		return fmt.Errorf("failed to base64 decode clientID: %v", err)
	}

	client := string(decodeID)
	Organizer := election.Organizer
	if client != Organizer {
		return fmt.Errorf("election can only be closed by organizer: %v", err)
	}

	// Check that the election is open
	Status := election.Status
	if Status != "open" {
		return fmt.Errorf("election must be open in order to close")
	}

	// Close the election
	election.Status = string("closed")
	newElectionJSON, _ := json.Marshal(election)

	// Update the election in state
	err = ctx.GetStub().PutState(electionName, newElectionJSON)
	if err != nil {
		return fmt.Errorf("failed to close election: %v", err)
	}

	return nil
}

// Make the votes public following election close
func (s *SmartContract) DisplayVote(
	ctx contractapi.TransactionContextInterface, electionName string, transactionID string,
) error {
	// Get vote from transient map
	transientMap, err := ctx.GetStub().GetTransient()
	if err != nil {
		return fmt.Errorf("error getting transient map: %v", err)
	}

	voteJSON, ok := transientMap["vote"]
	if !ok {
		return fmt.Errorf("vote key not found in the transient map")
	}

	// Create collection name using voter's organization ID
	clientMSPID, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get verified MSPID: %v", err)
	}

	orgCollection := "_implicit_org_" + clientMSPID

	// Create composite vote key using the input transaction ID
	voteKey, err := ctx.GetStub().CreateCompositeKey("vote", []string{electionName, transactionID})
	if err != nil {
		return fmt.Errorf("composite key could not be created: %v", err)
	}

	// Get the vote hash of the vote if it is on the ledger
	voteHash, err := ctx.GetStub().GetPrivateDataHash(orgCollection, voteKey)
	if err != nil {
		return fmt.Errorf("failed to read vote hash from collection: %v", err)
	}

	if voteHash == nil {
		return fmt.Errorf("vote hash does not exist: %s", voteKey)
	}

	// Get election from state
	election, err := s.QueryElection(ctx, electionName)
	if err != nil {
		return fmt.Errorf("failed to get election from state: %v", err)
	}

	// #1: Check that election is closed. We cannot display votes if it is still open.
	Status := election.Status
	if Status != "closed" {
		return fmt.Errorf("election must be closed to display votes")
	}

	// #2: Check that hash of public vote matches hash of private vote added earlier
	// votes := election.PrivateVotes
	// privateVoteHash := votes[voteKey].Hash

	// if privateVoteHash != string(voteHash) {
	// 	return fmt.Errorf("hash %s for vote JSON %s does not match hash in election: %s",
	// 		privateVoteHash, voteJSON, voteHash,
	// 	)
	// }

	var publicVote *PublicVote
	err = json.Unmarshal(voteJSON, &publicVote)
	if err != nil {
		return fmt.Errorf("failed to unmarshal JSON: %v", err)
	}

	// #3: Check that this is being invoked by the voter
	base64ID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return fmt.Errorf("failed to read clientID: %v", err)
	}

	decodeID, err := base64.StdEncoding.DecodeString(base64ID)
	if err != nil {
		return fmt.Errorf("failed to base64 decode clientID: %v", err)
	}

	client := string(decodeID)
	if client != publicVote.VoteFrom {
		return fmt.Errorf("vote can only be made public by voter: %v", err)
	}

	// We can make the vote public if previous checks pass
	Vote := PublicVote{
		VoteFrom: publicVote.VoteFrom,
		VoteTo:   publicVote.VoteTo,
	}

	publicVotes := election.PublicVotes
	publicVotes[voteKey] = Vote
	election.PublicVotes = publicVotes
	election.NumOfVotes = election.NumOfVotes + 1

	newElectionJSON, _ := json.Marshal(election)

	// Update the election currently in state
	err = ctx.GetStub().PutState(electionName, newElectionJSON)
	if err != nil {
		return fmt.Errorf("failed to make votes public: %v", err)
	}

	return nil
}

// Evaluate the election winner
func (s *SmartContract) EvaluateElection(
	ctx contractapi.TransactionContextInterface, electionName string,
) (string, error) {
	// Get the election from public state
	election, err := s.QueryElection(ctx, electionName)
	if err != nil {
		return "", fmt.Errorf("failed to get election from state: %v", err)
	}

	// Confirm this was invoked by the organizer
	base64ID, err := ctx.GetClientIdentity().GetID()
	if err != nil {
		return "", fmt.Errorf("failed to read clientID: %v", err)
	}

	decodeID, err := base64.StdEncoding.DecodeString(base64ID)
	if err != nil {
		return "", fmt.Errorf("failed to base64 decode clientID: %v", err)
	}

	client := string(decodeID)

	Organizer := election.Organizer
	if client != Organizer {
		return "", fmt.Errorf("election can only be evaluated by organizer: %v", err)
	}

	// check that election is closed
	Status := election.Status
	if Status != "closed" {
		return "", fmt.Errorf("election must be closed in order to evaluate")
	}

	// Get the list of public votes
	publicVotes := election.PublicVotes
	if len(election.PublicVotes) == 0 {
		return "", fmt.Errorf("no votes have been made public: %v", err)
	}

	var c_one_count, c_two_count, c_three_count int = 0, 0, 0
	for _, vote := range publicVotes {
		if vote.VoteTo == election.CandidateOne {
			c_one_count += 1
		} else if vote.VoteTo == election.CandidateTwo {
			c_two_count += 1
		} else {
			c_three_count += 1
		}
	}

	// Find which candidate has highest num of votes
	winner := Candidate{
		Name:       election.CandidateOne,
		NumOfVotes: c_one_count,
	}
	var draw int = 0

	if c_two_count > winner.NumOfVotes {
		draw = 0
		winner.Name = election.CandidateTwo
		winner.NumOfVotes = c_two_count
	} else if c_two_count == winner.NumOfVotes {
		draw = 1
	}

	if c_three_count > winner.NumOfVotes {
		draw = 0
		winner.Name = election.CandidateThree
		winner.NumOfVotes = c_three_count
	} else if c_three_count == winner.NumOfVotes {
		draw = 1
	}

	if draw == 1 {
		return "There is a draw so the election has no winner", nil
	}

	election.Winner = winner.Name
	election.NumOfVotes = c_one_count + c_two_count + c_three_count
	election.Status = string("completed")

	finishedElectionJSON, _ := json.Marshal(election)

	// Update the election currently in state
	err = ctx.GetStub().PutState(electionName, finishedElectionJSON)
	if err != nil {
		return "", fmt.Errorf("failed to complete election: %v", err)
	}

	return election.Winner, nil
}
