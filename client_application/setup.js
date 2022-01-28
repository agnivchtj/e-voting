
const { Wallets } = require('fabric-network');
const { createWallet, createCCPOrg } = require('./appSetup');
const { registerAdmin, createCAClient, registerUser } = require('./caAdmin');
const FabricCAServices = require('fabric-ca-client');
const path = require('path');


async function run() {
    const user_ID = process.argv[2];
    const CA_admin = process.argv[3];

    if (CA_admin == undefined || user_ID == undefined) {
        console.log("Please enter the command appropriately!");
        process.exit(1);
    }

    try {
        console.log('\n--> Setting up entity');

        if (CA_admin != 'org1' && CA_admin != 'org2') {
            console.log('Admin not recognized. Please enter org1 or org2');
            process.exit(1);
        }

        const ccp = createCCPOrg(CA_admin);
        const caClient = createCAClient(FabricCAServices, ccp, `ca.${CA_admin}.example.com`);

        const wallet = await createWallet(Wallets, path.join(__dirname, `wallet/${CA_admin}`));

        if (user_ID == 'admin') {
            console.log('\n--> Enrolling admin');
            await registerAdmin(caClient, wallet, (CA_admin == 'org1') ? 'Org1MSP' : 'Org2MSP');
        } else {
            console.log('\n--> Registering user');
            await registerUser(caClient, wallet, (CA_admin == 'org1') ? 'Org1MSP' : 'Org2MSP', user_ID, `${CA_admin}.department1`);
        }
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
}

run();