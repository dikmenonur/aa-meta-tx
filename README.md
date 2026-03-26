

# 🚀 Account Abstraction & Meta Transaction Sponsorship

ERC-4337 standardı kullanılarak Sepolia testnet üzerinde geliştirilmiş **meta transaction sponsorship** sistemi.

> Kullanıcı (A), işlem başlatır → gas ücreti sponsor (X) tarafından ödenir.

---

## ✨ Özellikler

* ERC-4337 uyumlu Account Abstraction mimarisi
* Gas sponsorluğu (Paymaster mekanizması)
* Meta transaction desteği
* Sepolia testnet üzerinde deploy & test
* Hardhat tabanlı geliştirme ortamı

---

## 🧠 Senaryo

**A cüzdanı → B cüzdanına token gönderir, ancak gas ücretini X (sponsor) öder.**

---

## 🏗️ Mimari

```
A (SimpleAccount)
  │  UserOperation oluşturur & imzalar
  ▼
X (Sponsor / Paymaster)
  │  paymasterAndData imzalar
  ▼
EntryPoint
  ├── validateUserOp()                → A'nın imzası doğrulanır
  ├── validatePaymasterUserOp()       → X'in imzası doğrulanır
  └── execute()                       → Token transfer gerçekleşir
```

---

## 📦 Deploy Edilen Kontratlar (Sepolia)

| Contract           | Adres                                        | Açıklama               |
| ------------------ | -------------------------------------------- | ---------------------- |
| EntryPoint (v0.7)  | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | ERC-4337 core contract |
| TestToken          | —                                            | ERC-20 test token      |
| SimpleAccount      | —                                            | Akıllı cüzdan (A)      |
| VerifyingPaymaster | —                                            | Sponsor (X)            |

---

## ⚙️ Kurulum

### Gereksinimler

* Node.js 18+
* npm

### Adımlar

```bash
git clone https://github.com/KULLANICI_ADIN/aa-meta-tx.git
cd aa-meta-tx

npm install

cp .env.example .env
# .env dosyasını düzenle

npm run compile
```

---

## 🚀 Kullanım

### 1. Deploy

```bash
npm run deploy
```

Deploy sonrası:

* A cüzdanı oluşturulur
* Paymaster fonlanır
* Token mint edilir

Tüm adresler:

```
deployment.json
```

---

### 2. Meta Transaction Gönder

```bash
npm run send
```

Örnek çıktı:

```
✅ Meta Transaction Successful

Tx Hash     : 0x...
Gas Used    : 285432
Paid By     : Sponsor (X)

Balances:
  A : 1000 → 900 TTK
  B : 0 → 100 TTK
```

---

### 3. Testler

```bash
npm test
```

---

### 4. Etherscan Doğrulama

```bash
npx hardhat verify --network sepolia <TOKEN_ADDRESS>

npx hardhat verify --network sepolia <ACCOUNT_ADDRESS> \
"0x0000000071727De22E5E9d8BAf0edAc6f37da032" "<A_WALLET>"

npx hardhat verify --network sepolia <PAYMASTER_ADDRESS> \
"0x0000000071727De22E5E9d8BAf0edAc6f37da032" "<SPONSOR_ADDRESS>"
```

---

## 🔐 .env Yapılandırması

```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
PRIVATE_KEY=0x...          # Sponsor (X)
ETHERSCAN_API_KEY=...
B_WALLET_ADDRESS=0x...
```

---

## 💧 Sepolia Faucet

Test ETH almak için:

* [https://sepoliafaucet.com](https://sepoliafaucet.com)
* [https://www.infura.io/faucet/sepolia](https://www.infura.io/faucet/sepolia)

---

## 📁 Proje Yapısı

```
aa-meta-tx/
├── contracts/
│   ├── TestToken.sol
│   ├── SimpleAccount.sol
│   └── VerifyingPaymaster.sol
│
├── scripts/
│   ├── deploy.ts
│   └── sendMetaTx.ts
│
├── test/
│   └── MetaTx.test.ts
│
├── hardhat.config.ts
├── .env.example
└── README.md
```

---

## ⚡ Teknik Detaylar (ERC-4337)

### UserOperation (v0.7)

```ts
{
  sender: string,
  nonce: bigint,
  initCode: string,
  callData: string,
  accountGasLimits: string,
  preVerificationGas: bigint,
  gasFees: string,
  paymasterAndData: string,
  signature: string
}
```

---

## 🔑 İmzalama Süreci

1. `userOpHash = entryPoint.getUserOpHash(userOp)`
2. A → `sign(userOpHash)`
3. X → `sign(userOpHash)`
4. Bundler → EntryPoint’e gönderir

---

## 🎯 Neden Bu Proje?

* Web3 onboarding problemini çözer (gas-free UX)
* Wallet abstraction gerçek bir kullanım senaryosu sunar
* Paymaster implementasyonu ile production’a yakın mimari
---

## 📜 Lisans

MIT

---


