# Running chaincode using Intel SGX

In the repo README, we setup our local environments to run and support Fabric Private Chaincode. Now, we will use this framework to invoke transactions on our chaincode, making use of the FPC Client SDK for Go as well.

The chaincode can be found in this folder for the key functions of the smart contract, such as createElection, queryElection, submitVote, queryVote, closeElection and evaluateElection. These functions all make use of various dependencies installed by FPC during setup, such as the shim.h and parson.h files, and thus please ensure the environment variables are properly set.

## Execution

To build the chaincode, we make use of CMake; this tool simplifies the build process and compiles the chaincode using the SGX SDK installed by FPC. 

In the ```$FPC_PATH/chaincode-sgx``` folder, we build the chaincode with following:
```
make
```

This will build the enclave and should return a ```[100%] Built target enclave``` message in the output, which means the build is successful.

More instructions to follow.