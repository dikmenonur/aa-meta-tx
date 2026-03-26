import { ethers } from "hardhat";
import * as fs from "fs";

// Sepolia resmi ERC-4337 EntryPoint v0.7
const ENTRY_POINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("========================================");
  console.log("  Account Abstraction Deploy Script");
  console.log("========================================");
  console.log(`Network  : ${network.name} (chainId: ${network.chainId})`);
  console.log(`Deployer : ${deployer.address}`);
  console.log(`Balance  : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log("----------------------------------------");

  // ── 1. TestToken ──────────────────────────────────
  console.log("\n[1/4] Deploying TestToken...");
  const TestToken = await ethers.getContractFactory("TestToken");
  const token = await TestToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log(`      ✅ TestToken: ${tokenAddress}`);

  // ── 2. A Cüzdanı (SimpleAccount) ─────────────────
  console.log("\n[2/4] Creating A wallet & deploying SimpleAccount...");
  const aWallet = ethers.Wallet.createRandom();
  console.log(`      A Wallet EOA  : ${aWallet.address}`);
  console.log(`      A Private Key : ${aWallet.privateKey}  ← BUNU SAKLA!`);

  const SimpleAccount = await ethers.getContractFactory("SimpleAccount");
  const simpleAccount = await SimpleAccount.deploy(ENTRY_POINT_ADDRESS, aWallet.address);
  await simpleAccount.waitForDeployment();
  const simpleAccountAddress = await simpleAccount.getAddress();
  console.log(`      ✅ SimpleAccount: ${simpleAccountAddress}`);

  // ── 3. VerifyingPaymaster (X = sponsor = deployer) ─
  console.log("\n[3/4] Deploying VerifyingPaymaster...");
  const Paymaster = await ethers.getContractFactory("VerifyingPaymaster");
  const paymaster = await Paymaster.deploy(ENTRY_POINT_ADDRESS, deployer.address);
  await paymaster.waitForDeployment();
  const paymasterAddress = await paymaster.getAddress();
  console.log(`      ✅ Paymaster: ${paymasterAddress}`);

  // ── 4. Setup ──────────────────────────────────────
  console.log("\n[4/4] Setup...");

  // Paymaster'a 0.1 ETH deposit (gas rezervi)
  const depositTx = await paymaster.deposit({ value: ethers.parseEther("0.05") });
  await depositTx.wait();
  console.log(`      ✅ Paymaster funded: 0.05 ETH deposited to EntryPoint`);

  // A cüzdanına 1000 TTK mint et
  const mintTx = await token.mint(simpleAccountAddress, ethers.parseUnits("1000", 18));
  await mintTx.wait();
  console.log(`      ✅ Minted 1000 TTK → SimpleAccount`);

  // ── Özet & deployment.json ────────────────────────
  const deployment = {
    network: network.name,
    chainId: network.chainId.toString(),
    entryPoint: ENTRY_POINT_ADDRESS,
    testToken: tokenAddress,
    simpleAccount: simpleAccountAddress,
    paymaster: paymasterAddress,
    sponsor: deployer.address,
    aWallet: {
      address: aWallet.address,
      privateKey: aWallet.privateKey,
    },
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync("deployment.json", JSON.stringify(deployment, null, 2));

  console.log("\n========================================");
  console.log("  Deployment Complete!");
  console.log("========================================");
  console.log(`EntryPoint    : ${ENTRY_POINT_ADDRESS}`);
  console.log(`TestToken     : ${tokenAddress}`);
  console.log(`SimpleAccount : ${simpleAccountAddress}`);
  console.log(`Paymaster     : ${paymasterAddress}`);
  console.log(`Sponsor (X)   : ${deployer.address}`);
  console.log("\n📄 Adresleri deployment.json dosyasına kaydedildi.");
  console.log("\nEtherscan verification için:");
  console.log(`  npx hardhat verify --network sepolia ${tokenAddress}`);
  console.log(`  npx hardhat verify --network sepolia ${simpleAccountAddress} "${ENTRY_POINT_ADDRESS}" "${aWallet.address}"`);
  console.log(`  npx hardhat verify --network sepolia ${paymasterAddress} "${ENTRY_POINT_ADDRESS}" "${deployer.address}"`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
