const { Gateway, Wallets } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');
const { createCAClient, registerUser, registerAdmin } = require('../client_application/caAdmin');
const { createCCPOrg, createWallet } = require('../client_application/appSetup');


async function run() {
    try {
        // We will start the timer
        var startTime_Election = new Date().getTime();

        // We will setup a ccp
        const ccp = createCCPOrg('org1');
        const caClient = createCAClient(FabricCAServices, ccp, 'ca.org1.example.com');
        const wallet = await createWallet(Wallets, path.join(__dirname, 'wallet/org1'));

        // Register the organization admin
        await registerAdmin(caClient, wallet, 'Org1MSP');

        // Register the organizer
        await registerUser(caClient, wallet, 'Org1MSP', 'organizer', 'org1.department1');

        // Register voter #1 && voter #2
        await registerUser(caClient, wallet, 'Org1MSP', 'voter1', 'org1.department1');

        // Go through the functions
        let gateway = new Gateway();
        await gateway.connect(
            ccp, 
            {
                wallet: wallet, 
                identity: 'organizer', 
                discovery: { enabled: true, asLocalhost: true }
            }
        );

        let network = await gateway.getNetwork('mychannel');
        let smartContract = network.getContract('election');

        // Go through the functions
        // 1. Create a new election
        console.log('\n--> Creating a new election');
        await smartContract
            .createTransaction('CreateElection')
            .submit(
                'testElection', 'candidateOne', 'candidateTwo', 'candidateThree'
            );

        gateway.disconnect();

        let txID = "";

        // 2. Submit vote to election
        gateway = new Gateway();
        await gateway.connect(
            ccp, {
                wallet: wallet, 
                identity: `voter1`, 
                discovery: { enabled: true, asLocalhost: true }
            }
        );

        network = await gateway.getNetwork('mychannel');
        smartContract = network.getContract('election');

        let voter = await smartContract.evaluateTransaction('QueryIdentity');

        let transaction = smartContract.createTransaction('AddVote');
        transaction.setEndorsingOrganizations('Org1MSP');
        transaction.setTransient({
            vote: Buffer.from(JSON.stringify({
                voteFrom: voter.toString(), 
                voteTo: 'candidateOne'
            }))
        });

        await transaction.submit('testElection');
        txID = transaction.getTransactionId().toString();

        console.log('\n--> Submitting vote to election for voter1');
        let submitTransaction = smartContract.createTransaction('SubmitVote');
        submitTransaction.setEndorsingOrganizations('Org1MSP', 'Org2MSP');
        await submitTransaction
            .submit(
                'testElection', transaction.getTransactionId().toString()
            );

        gateway.disconnect();

        // 3. Close election
        gateway = new Gateway();
        await gateway.connect(
            ccp, 
            {
                wallet: wallet, 
                identity: 'organizer', 
                discovery: { enabled: true, asLocalhost: true }
            }
        );

        network = await gateway.getNetwork('mychannel');
        smartContract = network.getContract('election');

        console.log('\n--> Closing the election');
        transaction = smartContract.createTransaction('CloseElection');
        transaction.setEndorsingOrganizations('Org1MSP', 'Org2MSP');
        await transaction.submit('testElection');

        gateway.disconnect();

        // 4. Display the vote
        gateway = new Gateway();
        await gateway.connect(
            ccp, {
                wallet: wallet, 
                identity: `voter1`, 
                discovery: { enabled: true, asLocalhost: true }
            }
        );

        network = await gateway.getNetwork('mychannel');
        smartContract = network.getContract('election');

        console.log('\n--> Making vote public for voter1');

        let vote = await smartContract.evaluateTransaction('QueryVote', 'testElection', txID);
        let voteJSON = JSON.parse(vote);

        transaction = smartContract.createTransaction('DisplayVote');
        transaction.setEndorsingOrganizations('Org1MSP');
        transaction.setTransient({
            vote: Buffer.from(JSON.stringify({
                voteFrom: voteJSON.voteFrom, 
                voteTo: voteJSON.voteTo
            }))
        });

        transaction.setEndorsingOrganizations('Org1MSP', 'Org2MSP');
        await transaction.submit('testElection', txID);

        gateway.disconnect();

        // 5. Evaluate the winner
        var startTime_Evaluate = new Date().getTime();

        gateway = new Gateway();
        await gateway.connect(
            ccp, 
            {
                wallet: wallet, 
                identity: 'organizer', 
                discovery: { enabled: true, asLocalhost: true }
            }
        );

        network = await gateway.getNetwork('mychannel');
        smartContract = network.getContract('election');

        console.log('\n--> Evaluating the election...');

        let election_winner = await smartContract.evaluateTransaction('EvaluateElection', 'testElection');
        console.log('\n--> Result: The candidate with most votes is ' + election_winner.toString());

        gateway.disconnect();

        var endTime_Election = new Date().getTime();
        console.log(`\n--> Evaluation ran for ${endTime_Election - startTime_Evaluate} ms`);
        console.log(`\n--> The election ran for ${endTime_Election - startTime_Election} ms`);

    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

run();