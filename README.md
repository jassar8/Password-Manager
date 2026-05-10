# Password Manager (offline demo)

Small browser-only password manager using `localStorage`. **Branch `main`** uses a hardcoded XOR key in JavaScript (intentionally insecure, for teaching). **Branch `feature/harder-to-steal-derived-key`** derives the XOR key from the master password with PBKDF2.

---

## How the Derived XOR Key Works

**Flow:** `User master password` → **PBKDF2** (with per-user salt + many iterations) → **32-byte XOR key in memory** → **encrypt / decrypt** each saved site password (`encryptPassword` / `decryptPassword` in `script.js`).

1. The user types a **master password** at login. It is **not** stored in plain text in `localStorage`.
2. A random **salt** (`kdfSalt`) is stored per user in `localStorage` (it is not secret; it just makes each user’s key different).
3. **PBKDF2** mixes the master password and salt and runs **210,000** iterations of **SHA-256** (see `KDF_ITERATIONS` and `KDF_HASH` in `script.js`). The output is **256 bits** — that byte array is the **derived XOR key** kept in the variable `activeEncryptionKeyBytes` only while the session is active.
4. Each site password is **XOR’d** with that derived key, then stored as `v2:` + Base64.

**Why stealing only the frontend code is not enough to “know the real key” anymore**

On **`main`**, the XOR key is a **string literal in the source** — anyone with the `.js` file can decrypt every `v2:` value. On the **feature branch**, the key is **computed** from the master password + salt. The **source code** describes *how* to derive the key, but **not** the key itself. An attacker with the repo and a `localStorage` dump still needs the **master password** (or a brute-force attack slowed by PBKDF2) to reproduce the same XOR bytes. This is a teaching step toward real designs (e.g. AES-GCM); it is **not** a complete threat model.

**Presentation demo:** With `LOG_CRYPTO_DEMO_TO_CONSOLE = true` in `script.js`, signing in logs a sample derivation to the browser console. **Turn it off** after class — real apps must never log passwords or keys.
