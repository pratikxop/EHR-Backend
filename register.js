'use strict';

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

// Path to the connection profile
const ccpPath = '/home/xop/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json';

async function main() {
    try {
        // Load the network configuration
        const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
        const ccp = JSON.parse(ccpJSON);

        // Create a new CA client for interacting with the CA
        const caInfo = ccp.certificateAuthorities['ca.org1.example.com'];
        const ca = new FabricCAServices(caInfo.url);

        // Create a new wallet instance
        const walletPath = path.join(__dirname, 'wallet');
        
        // Ensure wallet directory exists
        if (!fs.existsSync(walletPath)) {
            fs.mkdirSync(walletPath, { recursive: true });
        }
        
        const wallet = await Wallets.newFileSystemWallet(walletPath);

        // Check if the user is already enrolled
        const userIdentity = await wallet.get('user1');
        if (userIdentity) {
            console.log("An identity for 'user1' already exists in the wallet.");
            return;
        }

        // Get the admin identity from the wallet
        const adminIdentity = await wallet.get('admin');
        if (!adminIdentity) {
            console.log("Admin identity not found in the wallet. Run enrollAdmin.js first.");
            return;
        }

        // Build admin user object for interaction with CA
        const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
        const adminUser = await provider.getUserContext(adminIdentity, 'admin');

        try {
            // Attempt to register the user
            await ca.register(
                { affiliation: 'org1.department1', enrollmentID: 'user1', role: 'client' },
                adminUser
            );
            console.log("User 'user1' registered successfully.");
        } catch (error) {
            if (error.message.includes("already registered")) {
                console.log("User 'user1' is already registered. Skipping registration.");
            } else {
                throw error; // Re-throw unexpected errors
            }
        }

        // Enroll the user
        const enrollment = await ca.enroll({
            enrollmentID: 'user1',
            enrollmentSecret: 'user1pw',
        });

        // Create user identity and store it in the wallet
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: 'Org1MSP',
            type: 'X.509',
        };
        
        await wallet.put('user1', x509Identity);
        console.log("Successfully enrolled user 'user1' and stored it in the wallet.");

    } catch (error) {
        console.error(`Failed to register/enroll user1: ${error}`);
    }
}

main();
