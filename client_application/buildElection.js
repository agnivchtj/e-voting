
const { Wallets, Gateway } = require('fabric-network');
const { buildWallet, buildCCPOrg1, buildCCPOrg2 } = require('../../test-application/javascript/AppUtil');
const path = require('path');


async function buildElection(walletDetails, ccpPath, user_ID, electionName, candidateOne, candidateTwo, candidateThree) {
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

        console.log('\n--> Invoke e-voting chaincode: Create a new election');
        await smartContract
            .createTransaction('CreateElection')
            .submit(
                electionName, candidateOne, candidateTwo, candidateThree
            );
        console.log('\n--> Result: OK');

        gateway.disconnect();

    } catch (error) {
        console.log(`\n--> Failed to create election: ${error}`, error);
    }
}


async function main() {
    const user_ID = process.argv[2];
    const CA_admin = process.argv[3];
    const electionName = process.argv[4];
    const candidateOne = process.argv[5];
    const candidateTwo = process.argv[6];
    const candidateThree = process.argv[7];

    if (CA_admin == undefined || user_ID == undefined || electionName == undefined 
        || candidateOne == undefined || candidateTwo == undefined || candidateThree == undefined
    ) {
        console.log("Please enter all the parameters required!");
        process.exit(1);
    }

    try {
        console.log("\n--> Creating a new election");

        if (CA_admin != 'org1' && CA_admin != 'org2') {
            console.log('Admin not recognized. Please enter org1 or org2');
            process.exit(1);
        }

        const ccp = (CA_admin == 'org1') ? buildCCPOrg1() : buildCCPOrg2();
        const wallet = await buildWallet(Wallets, path.join(__dirname, 'wallet/' + CA_admin));
        await buildElection(wallet, ccp, user_ID, electionName, candidateOne, candidateTwo, candidateThree);

    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

main();