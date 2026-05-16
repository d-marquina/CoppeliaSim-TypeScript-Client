/**
 * CoppeliaSim WebSocket Remote API Client — Native TypeScript Implementation.
 *
 * A drop-in replacement for the official browser-only RemoteAPIClient.js,
 * designed to work in both Node.js and browser environments.
 *
 * @example
 * ```typescript
 * import { RemoteAPIClient } from './lib/RemoteAPIClient';
 *
 * const client = new RemoteAPIClient('localhost', 23050);
 * await client.connect();
 *
 * const sim = await client.require('sim');
 * const [handle] = await sim.getObject('/Floor');
 * console.log('Floor handle:', handle);
 *
 * await client.disconnect();
 * ```
 */

import type {
    ClientOptions,
    CoppeliaModuleMap,
    WsRequest,
    WsResponse,
    ApiMemberInfo,
} from '../types/remote-api';

// ─── WebSocket Abstraction ──────────────────────────────────────────────────

/**
 * Minimal WebSocket interface shared between browser's native WebSocket and
 * the Node.js `ws` package. We only depend on the subset we actually use.
 */
interface IWebSocket {
    readyState: number;
    onopen: ((event: any) => void) | null;
    onclose: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    onmessage: ((event: any) => void) | null;
    send(data: string): void;
    close(code?: number, reason?: string): void;
}

/** WebSocket readyState constants */
const WS_OPEN = 1;

/**
 * Creates a WebSocket instance, using the native browser WebSocket or
 * the `ws` npm package for Node.js.
 */
function createWebSocket(url: string): IWebSocket {
    // Browser environment: native WebSocket is available
    if (typeof globalThis.WebSocket !== 'undefined') {
        return new globalThis.WebSocket(url) as unknown as IWebSocket;
    }

    // Node.js environment: try to load the `ws` package
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const WS = require('ws');
        return new WS(url) as IWebSocket;
    } catch {
        throw new Error(
            'No WebSocket implementation found. ' +
            'In Node.js, install the "ws" package: npm install ws'
        );
    }
}

// ─── Request ID Generator ───────────────────────────────────────────────────

let _nextId = 1;
function generateRequestId(): string {
    return `req_${_nextId++}`;
}

// ─── Pending Request Tracking ───────────────────────────────────────────────

interface PendingRequest {
    resolve: (value: any[]) => void;
    reject: (reason: any) => void;
    timer: ReturnType<typeof setTimeout>;
}

// ─── RemoteAPIClient Class ──────────────────────────────────────────────────

export class RemoteAPIClient {
    private host: string;
    private port: number;
    private codec: 'json';
    private timeout: number;
    private verbose: boolean;
    private ws: IWebSocket | null = null;
    private pendingRequests = new Map<string, PendingRequest>();

    /**
     * Create a new CoppeliaSim WebSocket Remote API client.
     *
     * @param host - Server hostname. Default: `'localhost'`
     * @param port - Server port. Default: `23050`
     * @param options - Additional configuration options
     */
    constructor(host: string = 'localhost', port: number = 23050, options: ClientOptions = {}) {
        this.host = host;
        this.port = port;
        this.codec = options.codec ?? 'json';
        this.timeout = options.timeout ?? 10_000;
        this.verbose = options.verbose ?? false;
    }

    // ── Connection Management ───────────────────────────────────────────

    /**
     * Open the WebSocket connection to CoppeliaSim.
     * Resolves when the connection is established.
     *
     * @throws Error if the connection fails or times out
     */
    async connect(): Promise<void> {
        if (this.ws && this.ws.readyState === WS_OPEN) {
            this.log('Already connected');
            return;
        }

        const url = `ws://${this.host}:${this.port}`;
        this.log(`Connecting to ${url}...`);

        return new Promise<void>((resolve, reject) => {
            const ws = createWebSocket(url);

            const connectionTimeout = setTimeout(() => {
                ws.close();
                reject(new Error(`Connection timeout after ${this.timeout}ms`));
            }, this.timeout);

            ws.onopen = () => {
                clearTimeout(connectionTimeout);
                this.ws = ws;
                this.log('Connected');
                resolve();
            };

            ws.onerror = (event: any) => {
                clearTimeout(connectionTimeout);
                const msg = event?.message || event?.error || 'WebSocket error';
                reject(new Error(`Connection failed: ${msg}`));
            };

            ws.onclose = (event: any) => {
                clearTimeout(connectionTimeout);
                this.handleClose(event);
            };

            ws.onmessage = (event: any) => {
                this.handleMessage(event);
            };
        });
    }

    /**
     * Close the WebSocket connection gracefully.
     */
    async disconnect(): Promise<void> {
        if (!this.ws) return;

        return new Promise<void>((resolve) => {
            const ws = this.ws!;
            const previousOnClose = ws.onclose;

            ws.onclose = (event: any) => {
                if (previousOnClose) previousOnClose(event);
                resolve();
            };

            // Reject all pending requests
            for (const [id, pending] of this.pendingRequests) {
                clearTimeout(pending.timer);
                pending.reject(new Error('Client disconnected'));
            }
            this.pendingRequests.clear();

            ws.close(1000, 'Client disconnect');
            this.ws = null;
            this.log('Disconnected');
        });
    }

    /**
     * Check if the client is currently connected.
     */
    get connected(): boolean {
        return this.ws !== null && this.ws.readyState === WS_OPEN;
    }

    // ── RPC Call ─────────────────────────────────────────────────────────

    /**
     * Call a remote CoppeliaSim function.
     *
     * @param func - Fully qualified function name (e.g., `'sim.getObject'`)
     * @param args - Array of arguments to pass to the function
     * @returns The `ret` array from the server response
     * @throws Error string from the server if the call fails
     *
     * @example
     * ```typescript
     * const [handle] = await client.call('sim.getObject', ['/Floor']);
     * ```
     */
    async call(func: string, args: any[] = []): Promise<any[]> {
        if (!this.ws || this.ws.readyState !== WS_OPEN) {
            throw new Error('Not connected. Call connect() first.');
        }

        const id = generateRequestId();
        const request: WsRequest = { id, func, args };

        this.log(`→ ${func}(${args.map(a => JSON.stringify(a)).join(', ')}) [${id}]`);

        return new Promise<any[]>((resolve, reject) => {
            // Set up timeout
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timeout: ${func} [${id}] after ${this.timeout}ms`));
            }, this.timeout);

            // Track the pending request
            this.pendingRequests.set(id, { resolve, reject, timer });

            // Send the message
            const message = this.packMessage(request);
            this.ws!.send(message);
        });
    }

    // ── Module Loading (Typed Proxy) ────────────────────────────────────

    /**
     * Load a CoppeliaSim module and return a typed proxy object.
     *
     * The proxy provides full TypeScript autocompletion for all functions
     * and constants of the requested module.
     *
     * @param name - Module name (e.g., `'sim'`, `'simIK'`, `'simUI'`)
     * @returns A typed proxy with async methods and constant values
     *
     * @example
     * ```typescript
     * const sim = await client.require('sim');
     * const [handle] = await sim.getObject('/Floor');  // ← Full autocompletion
     * console.log(sim.handle_all);                      // ← Constant access
     * ```
     */
    async require<K extends keyof CoppeliaModuleMap>(name: K): Promise<CoppeliaModuleMap[K]>;
    async require(name: string): Promise<Record<string, any>>;
    async require(name: string): Promise<any> {
        this.log(`Loading module "${name}"...`);

        // Tell the server to load/enable the module
        await this.call('wsRemoteApi.require', [name]);

        // Get the module's API structure
        const proxy = await this.getObject(name);

        this.log(`Module "${name}" loaded`);
        return proxy;
    }

    // ── Private: Proxy Building ─────────────────────────────────────────

    /**
     * Query the server for a module/object's API structure and build a proxy.
     */
    private async getObject(name: string): Promise<Record<string, any>> {
        const [info] = await this.call('wsRemoteApi.info', [name]);
        return this.buildProxy(name, info as Record<string, ApiMemberInfo>);
    }

    /**
     * Recursively build a proxy object from the API structure info.
     *
     * For each key in the info:
     * - `{ func: ... }` → creates an async function that calls `client.call()`
     * - `{ const: value }` → stores the constant value directly
     * - Otherwise → recursively builds a sub-proxy (nested namespace)
     */
    private buildProxy(
        name: string,
        info: Record<string, ApiMemberInfo>,
    ): Record<string, any> {
        const proxy: Record<string, any> = {};

        for (const key in info) {
            const member = info[key];
            const memberKeys = Object.keys(member);

            if (memberKeys.length === 1 && member.func !== undefined) {
                // Function: create an async call wrapper
                const fullName = `${name}.${key}`;
                proxy[key] = async (...args: any[]) => {
                    return await this.call(fullName, args);
                };
            } else if (memberKeys.length === 1 && member.const !== undefined) {
                // Constant: store the value directly
                proxy[key] = member.const;
            } else {
                // Nested object: recursively build sub-proxy
                proxy[key] = this.getObject(`${name}.${key}`);
            }
        }

        return proxy;
    }

    // ── Private: Message Handling ────────────────────────────────────────

    /**
     * Handle incoming WebSocket messages.
     * Parses the response, finds the matching pending request, and resolves/rejects it.
     */
    private handleMessage(event: any): void {
        const response = this.unpackMessage(event.data) as WsResponse;

        if (!response || !response.id) {
            this.log('⚠ Received message without id, ignoring');
            return;
        }

        const pending = this.pendingRequests.get(response.id);
        if (!pending) {
            this.log(`⚠ No pending request for id "${response.id}", ignoring`);
            return;
        }

        // Clean up
        clearTimeout(pending.timer);
        this.pendingRequests.delete(response.id);

        if (response.success) {
            this.log(`← [${response.id}] OK: ${JSON.stringify(response.ret)}`);
            pending.resolve(response.ret ?? []);
        } else {
            this.log(`← [${response.id}] ERROR: ${response.error}`);
            pending.reject(new Error(response.error ?? 'Unknown remote error'));
        }
    }

    /**
     * Handle WebSocket close events.
     * Rejects all pending requests.
     */
    private handleClose(_event: any): void {
        this.log('Connection closed');

        for (const [id, pending] of this.pendingRequests) {
            clearTimeout(pending.timer);
            pending.reject(new Error('Connection closed'));
        }
        this.pendingRequests.clear();
        this.ws = null;
    }

    // ── Private: Serialization ──────────────────────────────────────────

    private packMessage(data: WsRequest): string {
        return JSON.stringify(data);
    }

    private unpackMessage(raw: any): WsResponse {
        if (typeof raw === 'string') {
            return JSON.parse(raw);
        }
        // Handle Buffer / ArrayBuffer (Node.js `ws` sends Buffer by default)
        if (raw instanceof ArrayBuffer) {
            return JSON.parse(new TextDecoder().decode(raw));
        }
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw)) {
            return JSON.parse(raw.toString('utf-8'));
        }
        // Blob (browser)
        throw new Error('Unexpected message type. Set codec to "json" for text messages.');
    }

    // ── Private: Logging ────────────────────────────────────────────────

    private log(message: string): void {
        if (this.verbose) {
            console.log(`[CoppeliaSim] ${message}`);
        }
    }
}
