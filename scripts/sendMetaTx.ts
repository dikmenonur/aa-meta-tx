import { ethers } from "hardhat";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();

/**
 * Meta Transaction Demo Script
 *
 * Akış:
 *   1. deployment.json'dan adresleri oku
 *   2. A cüzdanı için UserOperation oluştur
 *   3. A özel anahtarıyla userOp'u imzala
 *   4. X (sponsor) özel anahtarıyla paymasterAndData imzala
 *   5. EntryPoint.handleOps ile gönder
 *   6. Gas'ın X tarafından ödendiğini Etherscan'da doğrula
 */

async function main() {
  // ── Adresleri yükle ──────────────────────────────
  if (!fs.existsSync("deployment.json")) {
    throw new Error("deployment.json bulunamadı. Önce deploy.ts çalıştırın.");
  }
  const dep = JSON.parse(fs.readFileSync("deployment.json", "utf8"));

  // B cüzdanı: token alacak normal adres (rastgele ya da .env'den)
  const bWalletAddress = process.env.B_WALLET_ADDRESS || ethers.Wallet.createRandom().address;

  console.log("========================================");
  console.log("  Meta Transaction Demo");
  console.log("========================================");
  console.log(`EntryPoint    : ${dep.entryPoint}`);
  console.log(`SimpleAccount : ${dep.simpleAccount}  (A cüzdanı)`);
  console.log(`Paymaster     : ${dep.paymaster}`);
  console.log(`TestToken     : ${dep.testToken}`);
  console.log(`B Wallet      : ${bWalletAddress}  (alıcı)`);
  console.log(`Sponsor (X)   : ${dep.sponsor}`);
  console.log("----------------------------------------");

  // ── Provider & Cüzdanlar ─────────────────────────
  const provider = ethers.provider;
  const sponsorWallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const aWallet = new ethers.Wallet(dep.aWallet.privateKey, provider);

  // ── Contract referansları ─────────────────────────
  const entryPoint = await ethers.getContractAt("IEntryPoint", dep.entryPoint);
  const simpleAccount = await ethers.getContractAt("SimpleAccount", dep.simpleAccount);
  const token = await ethers.getContractAt("TestToken", dep.testToken);

  // ── Bakiye kontrolü ───────────────────────────────
  const aBalance = await token.balanceOf(dep.simpleAccount);
  const bBalanceBefore = await token.balanceOf(bWalletAddress);
  const paymasterDeposit = await entryPoint.balanceOf(dep.paymaster);

  console.log(`\nBakiyeler:`);
  console.log(`  A (SimpleAccount) TTK : ${ethers.formatUnits(aBalance, 18)}`);
  console.log(`  B TTK (önce)          : ${ethers.formatUnits(bBalanceBefore, 18)}`);
  console.log(`  Paymaster deposit     : ${ethers.formatEther(paymasterDeposit)} ETH`);

  if (aBalance === 0n) throw new Error("A cüzdanında token yok!");
  if (paymasterDeposit < ethers.parseEther("0.01")) throw new Error("Paymaster deposit çok düşük!");

  // ── callData oluştur ──────────────────────────────
  const transferAmount = ethers.parseUnits("100", 18);

  // token.transfer(B, 100 TTK)
  const transferCallData = token.interface.encodeFunctionData("transfer", [
    bWalletAddress,
    transferAmount,
  ]);

  // simpleAccount.execute(tokenAddress, 0, transferCallData)
  const executeCallData = simpleAccount.interface.encodeFunctionData("execute", [
    dep.testToken,
    0,
    transferCallData,
  ]);

  // ── Gas parametreleri ─────────────────────────────
  const feeData = await provider.getFeeData();
  const nonce = await entryPoint.getNonce(dep.simpleAccount, 0);

  const maxFeePerGas = feeData.maxFeePerGas ?? ethers.parseUnits("10", "gwei");
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? ethers.parseUnits("2", "gwei");

  // ── UserOperation oluştur (imzasız) ───────────────
  const userOp: any = {
    sender: dep.simpleAccount,
    nonce: nonce,
    initCode: "0x",
    callData: executeCallData,
    // accountGasLimits: [verificationGasLimit (128bit) | callGasLimit (128bit)]
    accountGasLimits: ethers.solidityPacked(
      ["uint128", "uint128"],
      [200000n, 200000n]
    ),
    preVerificationGas: 60000n,
    // gasFees: [maxPriorityFeePerGas (128bit) | maxFeePerGas (128bit)]
    gasFees: ethers.solidityPacked(
      ["uint128", "uint128"],
      [maxPriorityFeePerGas, maxFeePerGas]
    ),
    paymasterAndData: "0x",
    signature: "0x",
  };

  // ── UserOp hash al & imzala ───────────────────────
  console.log("\n[1/3] UserOperation hash hesaplanıyor...");
  const userOpHash = await entryPoint.getUserOpHash(userOp);
  console.log(`      Hash: ${userOpHash}`);

  // A cüzdanı imzalar
  console.log("[2/3] A cüzdanı imzalıyor...");
  const aSignature = await aWallet.signMessage(ethers.getBytes(userOpHash));
  userOp.signature = aSignature;

  // X (sponsor) paymasterAndData imzalar
  console.log("[3/3] X (sponsor) imzalıyor...");
  const sponsorSignature = await sponsorWallet.signMessage(ethers.getBytes(userOpHash));
  userOp.paymasterAndData = ethers.concat([dep.paymaster, sponsorSignature]);

  // ── EntryPoint'e gönder ───────────────────────────
  console.log("\nUserOperation gönderiliyor...");
  const tx = await entryPoint.connect(sponsorWallet).handleOps(
    [userOp],
    sponsorWallet.address, // gas refund adresi
    { gasLimit: 1_000_000 }
  );

  console.log(`Tx hash: ${tx.hash}`);
  console.log("Onay bekleniyor...");
  const receipt = await tx.wait();

  // ── Sonuç ─────────────────────────────────────────
  const bBalanceAfter = await token.balanceOf(bWalletAddress);
  const aBalanceAfter = await token.balanceOf(dep.simpleAccount);

  console.log("\n========================================");
  console.log("  ✅ Meta Transaction Başarılı!");
  console.log("========================================");
  console.log(`Tx Hash     : ${receipt!.hash}`);
  console.log(`Gas Kullanım: ${receipt!.gasUsed.toString()}`);
  console.log(`Gas Ödendi  : ${dep.sponsor}  (X - Sponsor)`);
  console.log(`\nToken Bakiyeleri:`);
  console.log(`  A (önce → sonra) : ${ethers.formatUnits(aBalance, 18)} → ${ethers.formatUnits(aBalanceAfter, 18)} TTK`);
  console.log(`  B (önce → sonra) : ${ethers.formatUnits(bBalanceBefore, 18)} → ${ethers.formatUnits(bBalanceAfter, 18)} TTK`);
  console.log(`\n🔗 Etherscan: https://sepolia.etherscan.io/tx/${receipt!.hash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
