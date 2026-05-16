/**
 * CoppeliaSim WS Remote API with TypeScript — Example Usage
 *
 * Make sure CoppeliaSim is running with a scene loaded and the
 * WebSocket Remote API server enabled (default port: 23050).
 */

import { RemoteAPIClient } from '../src';

async function main() {
    // Create client with verbose logging enabled
    const client = new RemoteAPIClient('localhost', 23050, { verbose: true });

    // Connect to CoppeliaSim
    await client.connect();

    // Load the 'sim' module — full TypeScript autocompletion is available
    const sim = await client.require('sim');

    // Get an object handle (returns are wrapped in arrays per the WS protocol)
    const [floorHandle] = await sim.getObject('/Floor');
    console.log('Floor handle:', floorHandle);

    // Read simulation time
    const [simTime] = await sim.getSimulationTime();
    console.log('Simulation time:', simTime);

    // Access constants directly (no await needed)
    console.log('sim.handle_all =', sim.handle_all);

    // Disconnect
    await client.disconnect();
}

main().catch(console.error);
