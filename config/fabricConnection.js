const path = require('path');
const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');

const ccpPath = path.resolve(__dirname, '/home/xop/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/connection-org1.json');
const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

const walletPath = path.join(__dirname, '..', 'wallet');

const getContract = async () => {
  const wallet = await Wallets.newFileSystemWallet(walletPath);
  const gateway = new Gateway();
  await gateway.connect(ccp, {
    wallet,
    identity: 'user1', // Assumes identity enrolled as appUser
    discovery: { enabled: true, asLocalhost: true }
  });

  const network = await gateway.getNetwork('ehrchannel');
  const contract = network.getContract('ehr-go');
  return { contract, gateway };
};

module.exports = { getContract };
