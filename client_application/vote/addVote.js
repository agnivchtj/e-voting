
const { Wallets, Gateway } = require('fabric-network');
const { buildWallet, buildCCPOrg1, buildCCPOrg2 } = require('../../../test-application/javascript/AppUtil.js');
const path = require('path');


async function addVote(walletDetails, ccpPath, CA_admin, voter_ID, electionName, voteTo) {
    try {
        const gateway = new Gateway();
        await gateway.connect(
            ccpPath, {
                wallet: walletDetails, 
                identity: voter_ID, 
                discovery: { enabled: true, asLocalhost: true }
            }
        );

        const network = await gateway.getNetwork('mychannel');
        const smartContract = network.getContract('election');

        console.log('\n--> Invoke e-voting chaincode: Add a new vote');

        let voter = await smartContract.evaluateTransaction('QueryIdentity');
        let voterString = voter.toString().split(",")[0];
        console.log('\n--> Voter ID: ' + voterString.substring(6, voterString.length));

        let transaction = smartContract.createTransaction('AddVote');
        transaction.setEndorsingOrganizations((CA_admin == 'org1') ? 'Org1MSP' : 'Org2MSP');
        transaction.setTransient({
            vote: Buffer.from(JSON.stringify({
                voteFrom: voter.toString(), 
                voteTo: voteTo
            }))
        });

        await transaction.submit(electionName);
        console.log("\n--> Result: Vote: " + transaction.getTransactionId().toString());
        console.log("\n--> Result: OK");

        console.log('\n--> Invoke e-voting chaincode: Submit vote to specified election');

        let submitTransaction = smartContract.createTransaction('SubmitVote');
        submitTransaction.setEndorsingOrganizations('Org1MSP', 'Org2MSP');
        await submitTransaction
            .submit(
                electionName, 
                transaction.getTransactionId().toString()
            );
        console.log('\n--> Result: OK');

        gateway.disconnect();

    } catch (error) {
        console.log(error);
		process.exit(1);
    }
}


async function main() {
    const user_ID = process.argv[2];
    const CA_admin = process.argv[3];
    const electionName = process.argv[4];
    const voteTo = process.argv[5];

    if (CA_admin == undefined || user_ID == undefined || electionName == undefined || voteTo == undefined) {
        console.log("Please enter the parameters required.");
        process.exit(1);
    }

    try {
        if (CA_admin != 'org1' && CA_admin != 'org2') {
            console.log('Admin not recognized. Please enter org1 or org2');
            process.exit(1);
        }

        const ccp = (CA_admin == 'org1') ? buildCCPOrg1() : buildCCPOrg2();
        const wallet = await buildWallet(Wallets, path.join(__dirname, 'wallet/' + CA_admin));

        await addVote(wallet, ccp, CA_admin, user_ID, electionName, voteTo);

    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

main();