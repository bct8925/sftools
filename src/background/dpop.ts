// OAuth 2.0 DPoP (RFC 9449) for the service worker
// Salesforce requires a proof-of-possession control for connected apps. DPoP binds the
// access and refresh tokens to a key pair held by the extension, so a copied token is
// useless without the private key. The key is generated once per install with WebCrypto,
// is non-extractable, and lives in IndexedDB (CryptoKey objects can't go in chrome.storage).

const ALGORITHM: EcKeyGenParams = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN_ALGORITHM: EcdsaParams = { name: 'ECDSA', hash: 'SHA-256' };

const DB_NAME = 'sftools-dpop';
const STORE_NAME = 'keys';
const KEY_ID = 'default';

export const DPOP_SCHEME = 'DPoP';

interface DpopKey {
    keyPair: CryptoKeyPair;
    publicJwk: JsonWebKey;
}

export interface DpopKeyStore {
    load(): Promise<CryptoKeyPair | null>;
    save(keyPair: CryptoKeyPair): Promise<void>;
}

// --- Key storage ---

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function runStore<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
    return openDb().then(
        db =>
            new Promise<T>((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, mode);
                const request = fn(tx.objectStore(STORE_NAME));
                tx.oncomplete = () => {
                    db.close();
                    resolve(request.result as T);
                };
                tx.onerror = () => {
                    db.close();
                    reject(tx.error);
                };
            })
    );
}

const indexedDbKeyStore: DpopKeyStore = {
    async load() {
        const keyPair = await runStore<CryptoKeyPair | undefined>('readonly', store =>
            store.get(KEY_ID)
        );
        return keyPair ?? null;
    },
    async save(keyPair) {
        await runStore('readwrite', store => store.put(keyPair, KEY_ID));
    },
};

let keyStore: DpopKeyStore = indexedDbKeyStore;
let keyPromise: Promise<DpopKey> | null = null;

/** Test hook: swap the key store and forget the cached key */
export function setDpopKeyStore(store: DpopKeyStore | null): void {
    keyStore = store ?? indexedDbKeyStore;
    keyPromise = null;
    nonces.clear();
}

async function loadOrCreateKey(): Promise<DpopKey> {
    let keyPair = await keyStore.load();
    if (!keyPair) {
        // Private key is non-extractable; the public key is always exportable
        keyPair = await crypto.subtle.generateKey(ALGORITHM, false, ['sign', 'verify']);
        await keyStore.save(keyPair);
    }
    const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    return { keyPair, publicJwk: { kty, crv, x, y } };
}

function getKey(): Promise<DpopKey> {
    if (!keyPromise) {
        keyPromise = loadOrCreateKey().catch(error => {
            keyPromise = null;
            throw error;
        });
    }
    return keyPromise;
}

// --- Proof creation ---

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
    const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let binary = '';
    for (const byte of array) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlJson(value: unknown): string {
    return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

async function sha256Base64Url(value: string): Promise<string> {
    return base64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

/** htu is the request URL without query and fragment (RFC 9449 section 4.2) */
export function dpopTargetUri(url: string): string {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
}

export interface DpopProofOptions {
    method: string;
    url: string;
    /** Set for resource requests: the proof then carries the access token hash (ath) */
    accessToken?: string;
}

/**
 * Create a DPoP proof JWT for one HTTP request.
 * Uses any server nonce remembered for the URL's origin.
 */
export async function createDpopProof({
    method,
    url,
    accessToken,
}: DpopProofOptions): Promise<string> {
    const { keyPair, publicJwk } = await getKey();
    const header = { typ: 'dpop+jwt', alg: 'ES256', jwk: publicJwk };
    const payload: Record<string, unknown> = {
        jti: crypto.randomUUID(),
        htm: method.toUpperCase(),
        htu: dpopTargetUri(url),
        iat: Math.floor(Date.now() / 1000),
    };
    const nonce = nonces.get(new URL(url).origin);
    if (nonce) payload.nonce = nonce;
    if (accessToken) payload.ath = await sha256Base64Url(accessToken);

    const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
    // WebCrypto ECDSA returns r||s, which is already the JWS ES256 signature format
    const signature = await crypto.subtle.sign(
        SIGN_ALGORITHM,
        keyPair.privateKey,
        new TextEncoder().encode(signingInput)
    );
    return `${signingInput}.${base64Url(signature)}`;
}

// --- Server nonces (RFC 9449 sections 8 and 9) ---

const nonces = new Map<string, string>();

function findHeader(headers: Record<string, string> | undefined, name: string): string | undefined {
    if (!headers) return undefined;
    const lower = name.toLowerCase();
    const key = Object.keys(headers).find(k => k.toLowerCase() === lower);
    return key ? headers[key] : undefined;
}

/**
 * Remember a DPoP-Nonce the server sent, and say whether the response asked for one.
 * A use_dpop_nonce error (400 from the token endpoint, 401 from a resource) means the
 * request should be retried once with a new proof.
 */
export function handleDpopNonce(
    url: string,
    status: number,
    headers: Record<string, string> | undefined,
    body?: string
): boolean {
    const nonce = findHeader(headers, 'dpop-nonce');
    if (nonce) nonces.set(new URL(url).origin, nonce);
    if (!nonce || (status !== 400 && status !== 401)) return false;

    const challenge = findHeader(headers, 'www-authenticate') ?? '';
    return challenge.includes('use_dpop_nonce') || (body ?? '').includes('use_dpop_nonce');
}

// --- Authorization headers ---

function getAuthorization(headers: Record<string, string>): [string, string] | null {
    const key = Object.keys(headers).find(k => k.toLowerCase() === 'authorization');
    return key ? [key, headers[key]] : null;
}

/** Token scheme of an Authorization header value ("Bearer" or "DPoP") */
export function getTokenScheme(headers: Record<string, string> | undefined): string | null {
    const auth = headers && getAuthorization(headers);
    return auth ? auth[1].split(' ')[0] : null;
}

/**
 * Add a DPoP proof to a resource request that uses a DPoP-bound token
 * (Authorization: DPoP <token>). Other requests are returned unchanged.
 */
export async function withDpopProof(
    headers: Record<string, string>,
    method: string,
    url: string
): Promise<Record<string, string>> {
    const auth = getAuthorization(headers);
    if (!auth || !auth[1].startsWith(`${DPOP_SCHEME} `)) return headers;
    const accessToken = auth[1].slice(DPOP_SCHEME.length + 1);
    const proof = await createDpopProof({ method, url, accessToken });
    return { ...headers, DPoP: proof };
}

/** Normalize a token_type from a token response */
export function normalizeTokenType(tokenType: string | undefined): 'Bearer' | 'DPoP' {
    return tokenType?.toLowerCase() === 'dpop' ? 'DPoP' : 'Bearer';
}
