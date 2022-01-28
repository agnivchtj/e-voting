
const filePath = require('fs');
const path = require('path');


export function createCCPOrg(org) {
    if (org != 'org1' && org != 'org2') throw new Error('org must be either org1 or org2');

    const ccp = path.resolve(
        __dirname, '..', 'test-network', 'organizations', 'peerOrganizations', 
        `${org}.example.com`, 
        `connection-${org}.json`
    );

    const file_exists = filePath.existsSync(ccp);
    if (!file_exists) {
		throw new Error(`file could not be found: ${ccpPath}`);
	}

	const fileContent = filePath.readFileSync(ccp, 'utf8');

    // Create a JSON object using the file
	const ccpJSON = JSON.parse(fileContent);

	console.log(`Loaded config located at ${ccp}`);
	return ccpJSON;
}

export async function createWallet(Wallets, walletPath) {
    // Create a wallet to manage the entities
    let wallet = (walletPath) ? await Wallets.newFileSystemWallet(walletPath) : await Wallets.newInMemoryWallet();
    return wallet;
}
