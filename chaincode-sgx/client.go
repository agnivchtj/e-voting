package main

import (
	"os"

	fpc "github.com/hyperledger/fabric-private-chaincode/client_sdk/go/pkg/gateway"
	"github.com/hyperledger/fabric-private-chaincode/integration/client_sdk/go/utils"
	"github.com/hyperledger/fabric/common/flogging"
)

var logger = flogging.MustGetLogger("election")

func main() {
	ccID := os.Getenv("CC_ID")
	logger.Infof("Use Chaincode ID: %v", ccID)

	channelID := os.Getenv("CHAN_ID")
	logger.Infof("Use channel: %v", channelID)

	// get network
	network, err := utils.SetupNetwork(channelID)
	if err != nil {
		logger.Errorf("Error setting up network: %v", err)
	}

	// Get FPC Contract
	contract := fpc.GetContract(network, ccID)

	// 1. Create a new election titled 'Prime' with 3 candidates
	logger.Infof("--> Invoke e-voting chaincode: Create a new election")
	result, err = contract.SubmitTransaction("CreateElection", "electionPrime", "ben", "simon", "jim")
	if err != nil {
		logger.Fatalf("Could not create election: %v", err)
	}
	logger.Infof("--> Result: %s", string(result))


	// 2. Submit vote for candidate Ben
	logger.Infof("--> Invoke e-voting chaincode: Submit vote")
	result, err = contract.SubmitTransaction("SubmitVote", "voter1", "ben")
	if err != nil {
		logger.Fatalf("Could not submit vote: %v", err)
	}
	logger.Infof("--> Result: %s", string(result))


	// 3. Query the election we just created
	logger.Infof("--> Invoke e-voting chaincode: Query election")
	result, err = contract.EvaluateTransaction("QueryElection", "electionPrime")
	if err != nil {
		logger.Fatalf("Could not query election successfully: %v", err)
	}
	logger.Infof("--> Result: %s", string(result))


	// 4. Close the election and evaluate the candidate w/ most votes
	logger.Infof("--> Invoke e-voting chaincode: Close the election")
	result, err = contract.SubmitTransaction("CloseElection", "electionPrime")
	if err != nil {
		logger.Fatalf("Could not close the election yet: %v", err)
	}
	logger.Infof("--> Result: %s", string(result))

	
	logger.Infof("--> Invoke e-voting chaincode: Evaluate election")
	result, err = contract.EvaluateTransaction("EvaluateElection", "electionPrime")
	if err != nil {
		logger.Fatalf("Could not evaluate the election winner: %v", err)
	}
	logger.Infof("--> Result: %s", string(result))
}
