
const { Wallets, Gateway } = require('fabric-network');
const { createWallet, createCCPOrg } = require('../appSetup');
const path = require('path');


async function queryElection(walletDetails, ccpPath, user_ID, electionName) {
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

        console.log('\n--> Invoke e-voting chaincode: Get Election');
        let election = await smartContract.evaluateTransaction('QueryElection', electionName);
        console.log('\n--> Result: Election: ' + JSON.stringify(JSON.parse(election.toString()), null, 2));

        gateway.disconnect();

    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}


async function run() {
    const user_ID = process.argv[2];
    const CA_admin = process.argv[3];
    const electionName = process.argv[4];

    if (CA_admin == undefined || user_ID == undefined || electionName == undefined) {
        console.log('Please enter the parameters required!');
        process.exit(1);
    }

    try {
        console.log('\n--> Querying the election');

        if (CA_admin != 'org1' && CA_admin != 'org2') {
            console.log('Admin not recognized. Please enter org1 or org2');
            process.exit(1);
        }

        const ccp = createCCPOrg(CA_admin);
        const wallet = await createWallet(Wallets, path.join(__dirname, 'wallet/' + CA_admin));
        await queryElection(wallet, ccp, user_ID, electionName);

    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

run();