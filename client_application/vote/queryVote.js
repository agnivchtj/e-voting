
const { Wallets, Gateway } = require('fabric-network');
const { buildWallet, buildCCPOrg1, buildCCPOrg2 } = require('../../../test-application/javascript/AppUtil');
const path = require('path');

async function queryVote(walletDetails, ccpPath, user_ID, electionName, transactionID) {
    try {
        const gateway = new Gateway();
        await gateway.connect(
            ccpPath, 
            {
                wallet: walletDetails, 
                identity: user_ID, 
                discovery: { enabled: true, asLocalhost: true }
            }
        );

        const network = await gateway.getNetwork('mychannel');
        const smartContract = network.getContract('election');

        console.log('\n--> Invoke e-voting chaincode: Query vote');

        let transaction = await smartContract.evaluateTransaction('QueryVote', electionName, transactionID);
        let transactionJSON = JSON.parse(transaction.toString());
        let transactionDetails = {
            "voteFrom": transactionJSON.voteFrom.split(",")[0].substring(6, transactionJSON.voteFrom.split(",")[0].length), 
            "voteTo": transactionJSON.voteTo
        }
        console.log('\n--> Result: Vote: ' + JSON.stringify(transactionDetails));

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
    const transactionID = process.argv[5];

    if (CA_admin == undefined || user_ID == undefined || electionName == undefined || transactionID == undefined) {
        console.log("Please enter the parameters required");
        process.exit(1);
    }

    try {
        if (CA_admin != 'org1' && CA_admin != 'org2') {
            console.log('Admin not recognized. Please enter org1 or org2');
            process.exit(1);
        }

        const ccp = (CA_admin == 'org1') ? buildCCPOrg1() : buildCCPOrg2();
        const wallet = await buildWallet(Wallets, path.join(__dirname, 'wallet/' + CA_admin));
        await queryVote(wallet, ccp, user_ID, electionName, transactionID);

    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

main();