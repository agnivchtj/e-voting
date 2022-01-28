# E-voting

The following is the setup procedure to run the e-voting application; this project uses dependencies from Hyperledger Fabric and Intel SGX in order to perform secure voting. The project can be seen as having different parts to it, such as the client application, smart contracts for regular and SGX nodes as well as performance tests.

## Initial setup

We are assuming that prerequisite software, such as Go, NPM, Git, Docker etc. have already been installed on your machine. The guide for this can be found here: https://hyperledger-fabric.readthedocs.io/en/latest/prereqs.html. To begin, find a directory in your GOPATH and install Hyperledger Fabric:
```
$ mkdir -p $HOME/go/src/github.com/<your_github_userid>
$ cd $HOME/go/src/github.com/<your_github_userid>
$ curl -sSL https://bit.ly/2ysbOFE | bash -s
```

The above will install all the necessary components to run Hyperledger Fabric such as the binaries, samples and docker images. Once this is done, the repository can be cloned within the fabric-samples folder (and can use Fabric dependencies).
```
$ cd fabric-samples
$ git clone https://github.com/agnivchtj/e-voting
```

Once the repository has been copied to your local machine, you will have to install the Go and Node dependencies that our smart contract relies on to execute. This may take some time to complete and can be done as follows:
```
$ cd e-voting/smart-contract
$ go mod init

$ cd ..
$ npm install
```

This will establish the required ```node_modules``` and ```package-lock.json``` files which are necessary to run the smart contract using our client application. Further details on this can be found in the README in the client_application folder, which outlines how the terminal CLI can be used to run the smart contract.

## Test network

Once the project has been setup, we can go ahead and deploy our test network where we will execute our chaincode. We can create a channel for transactions between Org1 and Org2, which are the CA adminstrators of the channel, using the ```network.sh``` script in Fabric samples.

```
$ cd test-network
$ ./network.sh down
$ ./network.sh up createChannel -ca
```

This will setup the channel such that there is communication between entities belonging to the organizations mentioned above and we can use our smart contract to interact with the channel ledger. However, we must first deploy our chaincode onto the channel such that peers can endorse transactions from the client. This can be done as follows:

```
$ ./network.sh deployCC -ccn election -ccp ../e-voting -ccl go
```

The ```deployCC``` command will instantiate the chaincode on peer0.org1.example.com and peer0.org2.example.com as well as deploy the chaincode on the channel.

## Integration with Intel SGX

The project makes use of Intel SGX in order to perform security attestation of the smart contract. As a result, we have written chaincode for SGX to run and this can be found in the chaincode-sgx folder on this repository. In order to integrate Intel SGX, we have used the Fabric Private Chaincode framework developed by Brandenburger et. al (https://github.com/hyperledger/fabric-private-chaincode) to execute e-voting within an enclave and there is provided support for peer setup including the chaincode enclave, enclave endorsement validation, package shim and the enclave registry.

The FPC repo provides a step-by-step process on how to get started, and we have described the key steps below for convenience. Firstly, we can clone the framework repo as follows:
```
$ export FPC_PATH=$GOPATH/src/github.com/<your_github_userid>/fabric-private-chaincode
$ cd $FPC_PATH
$ git clone https://github.com/hyperledger/fabric-private-chaincode.git
```

The FPC framework involves a couple different ways to setup the development environment. The most preferred way (and the approach undertaken in this project) is to set up a Docker container that contains all necessary software dependencies to build and develop chaincode locally. Once the repository has been cloned, the Docker image can be pulled and the development container started:
```
$ cd $FPC_PATH/utils/docker
$ make pull-dev
$ make build-dev
$ make run-dev
```

The above command will fetch the FPC docker image and open a shell inside the container, with key dependencies such as the Intel SGX SDK and SSL which are used to build chaincode. If there are problems with the setup, please double-check the framework repository (https://github.com/hyperledger/fabric-private-chaincode) and ensure environment variables are properly assigned.

More details on how to use FPC to run our chaincode with SGX can be found in the README of the chaincode-sgx folder.

## Prototype & Discussion

Our approach makes use of a local Fabric test network consisting of a client node, two peers and an ordering service. Each node belongs to a Membership Service Provider (MSP) organization, which exists in Hyperledger Fabric to manage identities of the members in the network [17]. In our application, the peers represent voters that submit votes for the candidates in our election while the organizer of the election denotes the invoking client.

In order to incorporate trusted hardware, each peer in the Fabric network is equipped with a CPU that enables Intel SGX and can execute chaincode within a secure enclave. As opposed to running the entire blockchain node in SGX, only part of the peer resides in the enclave [7]; this minimizes the size of the trusted computing base (TCB), the attack surface and makes the system easier to evaluate as well.

The e-voting scheme has 7 main functions, which allow the user to create an election, query it, submit
encrypted votes, close the election, make votes visible and ultimately determine the candidate with most votes.

Ultimately, the greatest strength of this implementation stems from the fact that the operation runs within a secure enclave where the operations & data on the smart contract cannot be tampered with by external entities. Moreover, the prototype makes use of a 'barrier' concept where the election must be closed and votes displayed using original commit transaction ID before all peers on the network can see the public vote. This resolves risk of rollback attacks, where malicious peers can manipulate the order of transactions and reset the enclave multiple times to infer confidential information.

On the other hand, there are several limitations to our approach as well. Firstly, peers are required to maintain continuous communication with the channel throughout the e-voting process and this can introduce overhead costs. Then, since Fabric networks are permissioned, the platform owner may be able to influence the data in the enclave despite it being encrypted. Our implementation also does not model threat scenarios where there is a malicious node that may attempt to pass inputs that can cause non-determinism.

Finally, SGX can also have some inherent disadvantages such as limited memory; SGX supports secure memory of up to 128 MB for its enclave and there can be loss of performance if this is exceeded, which can have an impact on scalability. Another limitation is the risk of side-channel attacks. This arises when SGX shares
resources with other programs and a malicious node uses those shared resources to infer private data in the enclave.