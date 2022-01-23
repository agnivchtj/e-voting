
const { Wallets, Gateway } = require('fabric-network');
const { buildWallet, buildCCPOrg1, buildCCPOrg2 } = require('../../test-application/javascript/AppUtil');
const path = require('path');

async function closeElection(walletDetails, ccpPath, user_ID, electionName) {
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

        console.log('\n--> Invoke e-voting chaincode: Close election');

        let transaction = smartContract.createTransaction('CloseElection');
        transaction.setEndorsingOrganizations('Org1MSP', 'Org2MSP');
        await transaction.submit(electionName);
        
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

    if (user_ID == undefined || CA_admin == undefined || electionName == undefined) {
        console.log("Please enter the parameters required.");
        process.exit(1);
    }

    try {
        console.log('\n--> Closing the election');

        if (CA_admin != 'org1' && CA_admin != 'org2') {
            console.log('Admin not recognized. Please enter org1 or org2');
            process.exit(1);
        }

        const ccp = (CA_admin == 'org1') ? buildCCPOrg1() : buildCCPOrg2();
        const wallet = await buildWallet(Wallets, path.join(__dirname, 'wallet/' + CA_admin));
        await closeElection(wallet, ccp, user_ID, electionName);

    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

main();