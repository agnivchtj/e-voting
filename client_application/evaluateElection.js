
const { Wallets, Gateway } = require('fabric-network');
const { buildWallet, buildCCPOrg1, buildCCPOrg2 } = require('../../test-application/javascript/AppUtil');
const path = require('path');


async function evaluateElection(walletDetails, ccpPath, user_ID, electionName) {
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

        console.log('\n--> Invoke e-voting chaincode: Evaluate election');

        let election_winner = await smartContract.evaluateTransaction('EvaluateElection', electionName);
        console.log('\n--> Result: The candidate with most votes is ' + election_winner.toString());
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

    if (CA_admin == undefined || user_ID == undefined || electionName == undefined) {
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
        await evaluateElection(wallet, ccp, user_ID, electionName);

    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

main();