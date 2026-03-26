import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

// Sepolia EntryPoint v0.7 - local test için aynı adreste mock deploy edilecek
const ENTRY_POINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

/**
 * NOT: EntryPoint contract'ı Sepolia'dan fork etmek gerekir.
 * Yerel testler için Hardhat'ı Sepolia fork modunda çalıştırın:
 *
 *   npx hardhat test --network hardhat
 *   (hardhat.config.ts içine forking eklenirse tam entegrasyon testi çalışır)
 *
 * Aşağıdaki testler contract birim testlerini kapsar.
 */

describe("TestToken", function () {
  async function deployTokenFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const TestToken = await ethers.getContractFactory("TestToken");
    const token = await TestToken.deploy();
    return { token, owner, alice, bob };
  }

  it("Should mint 1,000,000 tokens to deployer", async function () {
    const { token, owner } = await loadFixture(deployTokenFixture);
    const balance = await token.balanceOf(owner.address);
    expect(balance).to.equal(ethers.parseUnits("1000000", 18));
  });

  it("Should allow minting to any address", async function () {
    const { token, alice } = await loadFixture(deployTokenFixture);
    const amount = ethers.parseUnits("500", 18);
    await token.mint(alice.address, amount);
    expect(await token.balanceOf(alice.address)).to.equal(amount);
  });

  it("Should transfer tokens correctly", async function () {
    const { token, owner, alice } = await loadFixture(deployTokenFixture);
    const amount = ethers.parseUnits("100", 18);
    await token.transfer(alice.address, amount);
    expect(await token.balanceOf(alice.address)).to.equal(amount);
  });
});

describe("SimpleAccount", function () {
  async function deployAccountFixture() {
    const [deployer, owner, other] = await ethers.getSigners();

    // EntryPoint'i mock olarak deployer adresi ile simüle ediyoruz
    // Gerçek test için Sepolia fork kullanın
    const SimpleAccount = await ethers.getContractFactory("SimpleAccount");

    // Basit bir mock entrypoint adresi olarak deployer'ı kullanıyoruz
    const account = await SimpleAccount.deploy(deployer.address, owner.address);

    const TestToken = await ethers.getContractFactory("TestToken");
    const token = await TestToken.deploy();

    return { account, token, deployer, owner, other };
  }

  it("Should set owner correctly", async function () {
    const { account, owner } = await loadFixture(deployAccountFixture);
    expect(await account.owner()).to.equal(owner.address);
  });

  it("Should execute token transfer when called by owner", async function () {
    const { account, token, owner, other } = await loadFixture(deployAccountFixture);

    // Account'a token gönder
    const amount = ethers.parseUnits("100", 18);
    await token.mint(await account.getAddress(), amount);

    // Owner olarak execute çağır
    const transferData = token.interface.encodeFunctionData("transfer", [
      other.address,
      amount,
    ]);
    await account.connect(owner).execute(await token.getAddress(), 0, transferData);

    expect(await token.balanceOf(other.address)).to.equal(amount);
  });

  it("Should reject execute from unauthorized address", async function () {
    const { account, token, other } = await loadFixture(deployAccountFixture);

    const transferData = token.interface.encodeFunctionData("transfer", [
      other.address,
      ethers.parseUnits("1", 18),
    ]);

    await expect(
      account.connect(other).execute(await token.getAddress(), 0, transferData)
    ).to.be.revertedWith("SimpleAccount: not owner or entryPoint");
  });

  it("Should execute batch operations", async function () {
    const { account, token, owner, other } = await loadFixture(deployAccountFixture);

    // Account'a token gönder
    const amount = ethers.parseUnits("200", 18);
    await token.mint(await account.getAddress(), amount);

    // İki ayrı adrese transfer
    const [recipient1, recipient2] = await ethers.getSigners().then((s) => s.slice(4, 6));
    const half = ethers.parseUnits("100", 18);

    const calls = [recipient1.address, recipient2.address].map((addr) =>
      token.interface.encodeFunctionData("transfer", [addr, half])
    );

    await account
      .connect(owner)
      .executeBatch(
        [await token.getAddress(), await token.getAddress()],
        calls
      );

    expect(await token.balanceOf(recipient1.address)).to.equal(half);
    expect(await token.balanceOf(recipient2.address)).to.equal(half);
  });
});

describe("VerifyingPaymaster", function () {
  async function deployPaymasterFixture() {
    const [deployer, sponsor, other] = await ethers.getSigners();

    const Paymaster = await ethers.getContractFactory("VerifyingPaymaster");
    // deployer'ı mock entrypoint olarak kullanıyoruz
    const paymaster = await Paymaster.deploy(deployer.address, sponsor.address);

    return { paymaster, deployer, sponsor, other };
  }

  it("Should set verifyingSigner correctly", async function () {
    const { paymaster, sponsor } = await loadFixture(deployPaymasterFixture);
    expect(await paymaster.verifyingSigner()).to.equal(sponsor.address);
  });

  it("Should reject zero address as signer", async function () {
    const [deployer] = await ethers.getSigners();
    const Paymaster = await ethers.getContractFactory("VerifyingPaymaster");
    await expect(
      Paymaster.deploy(deployer.address, ethers.ZeroAddress)
    ).to.be.revertedWith("Paymaster: zero signer");
  });
});
