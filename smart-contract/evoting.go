package main

import (
	"log"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	electionSmartContract, err := contractapi.NewChaincode(&SmartContract{})
	if err != nil {
		log.Panicf("Error creating e-voting chaincode: %v", err)
	}

	if err := electionSmartContract.Start(); err != nil {
		log.Panicf("Error creating e-voting chaincode: %v", err)
	}
}
