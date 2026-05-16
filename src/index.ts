/// <reference path="./types/coppeliasim-api.d.ts" />

/**
 * Entry point for the CoppeliaSim Typescript Remote API Client library.
 */

// Export the main client class
export { RemoteAPIClient } from './lib/RemoteAPIClient';

// Export type utilities and configurations
export type { ClientOptions, CoppeliaModuleMap, AsyncApi } from './types/remote-api';

