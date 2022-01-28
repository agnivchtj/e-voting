

export function createCAClient(FabricCAServices, ccpPath, CA_Hostname) {
    const ca = ccpPath.certificateAuthorities[CA_Hostname];
    const caCertificates = ca.tlsCACerts.pem;
    const caClient = new FabricCAServices(
        ca.url, 
        {
            trustedRoots: caCertificates, 
            verify: false
        }, 
        ca.caName
    );

    console.log(`Created a CA Client: ${ca.caName}`);
	return caClient;
}

export async function registerAdmin(caClient, wallet, mspId) {
    try {
       // Check if admin is already registered
       const id = await wallet.get('admin');
       if (id) {
           console.log(`An identity for the user ${wallet} is already enrolled`);
           return;
       }

       // Register the new admin and import it into wallet
       const register = await caClient.enroll({
           enrollmentID: 'admin', 
           enrollmentSecret: 'adminpw'
       });

       const identity = {
           creds: {
               certificate: register.certificate, 
               privateKey: register.key.toBytes()
           }, 
           mspID: mspId, 
           type: 'X.509'
       };

       await wallet.put('admin', identity);
       console.log('Admin has been registered and imported into wallet!');

    } catch(error) {
        console.error(`Failed to register admin due to error: ${error}`);
    }
}

export async function registerUser(caClient, wallet, mspId, user, org) {
    try {
        // Check if user is already registered
        const userId = await wallet.get(user);
        if (userId) {
            console.log(`The identity of user ${userId} exists in the wallet`);
            return;
        }

        const adminId = await wallet.get('admin');
        if (!adminId) {
            console.log('This admin does not exist in the wallet.');
            return;
        }

        // Build the user object
        const MSP_provider = wallet.getProviderRegistry().getProvider(adminId.type);
        const admin = await MSP_provider.getUserContext(adminId, 'admin');

        // Register the user object and import identity into wallet
        const private = await caClient.register({
        affiliation: org, 
        enrollmentID: user, 
        role: 'client'
        }, admin);

        const register = await caClient.enroll({
            enrollmentID: user, 
            enrollmentSecret: private
        });

        const identity = {
            creds: {
                certificate: register.certificate, 
                privateKey: register.key.toBytes()
            }, 
            mspID: mspId, 
            type: 'X.509'
        };

        await wallet.put(user, identity);
        console.log(`Successfully registered our user ${user} and imported it into wallet.`);

    } catch (error) {
        console.log(`Failed to register user due to error: ${error}`);
    }
}
