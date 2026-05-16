/// <reference path="./coppeliasim-api.d.ts" />

/**
 * Type utilities for the CoppeliaSim WS Remote API TypeScript client.
 *
 * These types bridge the gap between the synchronous type definitions in
 * coppeliasim-api.d.ts and the asynchronous reality of the WebSocket protocol,
 * where all function calls return Promises and single return values are wrapped
 * in arrays (e.g., `sim.getObject('/Floor')` returns `[37]`, not `37`).
 */

// ─── Core Type Transformer ──────────────────────────────────────────────────

/**
 * Converts a synchronous CoppeliaSim module interface into its async remote version.
 *
 * Transformation rules:
 * - Methods returning `void`        → `(...args) => Promise<void>`
 * - Methods returning a tuple `[A, B, ...]` → `(...args) => Promise<[A, B, ...]>`
 * - Methods returning a single `T`  → `(...args) => Promise<[T]>` (API wraps in array)
 * - Non-function properties (constants) remain unchanged
 *
 * @example
 * // Original (from coppeliasim-api.d.ts):
 * interface sim {
 *     getObject(path: string): number;
 *     getShapeMesh(handle: number): [number[], number[], number[]];
 *     startSimulation(): void;
 *     readonly handle_all: number;
 * }
 *
 * // AsyncApi<sim> becomes:
 * {
 *     getObject(path: string): Promise<[number]>;
 *     getShapeMesh(handle: number): Promise<[number[], number[], number[]]>;
 *     startSimulation(): Promise<void>;
 *     readonly handle_all: number;
 * }
 */
export type AsyncApi<T> = {
    [K in keyof T]: T[K] extends (...args: infer A) => infer R
        ? R extends void
            ? (...args: A) => Promise<void>
            : R extends [any, ...any[]]
                ? (...args: A) => Promise<R>
                : (...args: A) => Promise<[R]>
        : T[K];
};

// ─── Module Map ─────────────────────────────────────────────────────────────

/**
 * Maps CoppeliaSim module names (as strings) to their typed async API interfaces.
 * Used by `RemoteAPIClient.require()` to provide full autocompletion.
 *
 * @example
 * const sim = await client.require('sim');     // → AsyncApi<CoppeliaSim.sim>
 * const ik  = await client.require('simIK');   // → AsyncApi<CoppeliaSim.simIK>
 */
export interface CoppeliaModuleMap {
    sim: AsyncApi<CoppeliaSim.sim>;
    simAssimp: AsyncApi<CoppeliaSim.simAssimp>;
    simBWF: AsyncApi<CoppeliaSim.simBWF>;
    simBubble: AsyncApi<CoppeliaSim.simBubble>;
    simCHAI3D: AsyncApi<CoppeliaSim.simCHAI3D>;
    simCam: AsyncApi<CoppeliaSim.simCam>;
    simCmd: AsyncApi<CoppeliaSim.simCmd>;
    simConvex: AsyncApi<CoppeliaSim.simConvex>;
    simEigen: AsyncApi<CoppeliaSim.simEigen>;
    simEvents: AsyncApi<CoppeliaSim.simEvents>;
    simGLTF: AsyncApi<CoppeliaSim.simGLTF>;
    simGeom: AsyncApi<CoppeliaSim.simGeom>;
    simICP: AsyncApi<CoppeliaSim.simICP>;
    simIGL: AsyncApi<CoppeliaSim.simIGL>;
    simIK: AsyncApi<CoppeliaSim.simIK>;
    simIM: AsyncApi<CoppeliaSim.simIM>;
    simLDraw: AsyncApi<CoppeliaSim.simLDraw>;
    simMIDI: AsyncApi<CoppeliaSim.simMIDI>;
    simMTB: AsyncApi<CoppeliaSim.simMTB>;
    simMujoco: AsyncApi<CoppeliaSim.simMujoco>;
    simOMPL: AsyncApi<CoppeliaSim.simOMPL>;
    simOpenMesh: AsyncApi<CoppeliaSim.simOpenMesh>;
    simPython: AsyncApi<CoppeliaSim.simPython>;
    simQML: AsyncApi<CoppeliaSim.simQML>;
    simROS2: AsyncApi<CoppeliaSim.simROS2>;
    simRRS1: AsyncApi<CoppeliaSim.simRRS1>;
    simRemoteApi: AsyncApi<CoppeliaSim.simRemoteApi>;
    simSDF: AsyncApi<CoppeliaSim.simSDF>;
    simSubprocess: AsyncApi<CoppeliaSim.simSubprocess>;
    simSurfRec: AsyncApi<CoppeliaSim.simSurfRec>;
    simUI: AsyncApi<CoppeliaSim.simUI>;
    simURDF: AsyncApi<CoppeliaSim.simURDF>;
    simURLDrop: AsyncApi<CoppeliaSim.simURLDrop>;
    simVision: AsyncApi<CoppeliaSim.simVision>;
    simWS: AsyncApi<CoppeliaSim.simWS>;
    simZMQ: AsyncApi<CoppeliaSim.simZMQ>;
}

// ─── Client Options ─────────────────────────────────────────────────────────

/**
 * Configuration options for the RemoteAPIClient.
 */
export interface ClientOptions {
    /** Serialization codec. Default: 'json' */
    codec?: 'json';

    /** Request timeout in milliseconds. Default: 10000 */
    timeout?: number;

    /** Enable verbose logging to console. Default: false */
    verbose?: boolean;
}

// ─── Internal Protocol Types ────────────────────────────────────────────────

/** A request message sent to the CoppeliaSim WS Remote API server. */
export interface WsRequest {
    id: string;
    func: string;
    args: any[];
}

/** A response message received from the CoppeliaSim WS Remote API server. */
export interface WsResponse {
    id: string;
    success: boolean;
    ret?: any[];
    error?: string;
}

/** Metadata about an API member returned by `wsRemoteApi.info`. */
export interface ApiMemberInfo {
    func?: number;
    const?: any;
    [key: string]: any;
}
