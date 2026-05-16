# CoppeliaSim TypeScript Remote API Client

A modern, isomorphic (Universal) WebSocket client for the [CoppeliaSim](https://www.coppeliarobotics.com/) Remote API. 

This library is a native TypeScript drop-in replacement for the official browser-only `RemoteAPIClient.js`. It provides **full IDE autocompletion**, asynchronous bindings, and seamless compatibility with both Node.js (backend/CLI scripts) and modern web frameworks like React or Vue.

## Features

- 🌐 **Isomorphic Design**: Runs identically in **Node.js** (using the `ws` package) and in the **Browser** (using native `WebSocket`).
- 🤖 **Full Type Safety**: Generates typed proxies dynamically. If CoppeliaSim supports `sim.getObject()`, your IDE will know about it, autocomplete it, and enforce its types.
- 📦 **Promise-Based**: All remote calls are fully asynchronous. Say goodbye to callbacks.
- 🔌 **Zero-Config Setup**: Defaults to the standard CoppeliaSim WebSocket port (`23050`) using JSON serialization.

## Installation

Currently, this package is intended to be used directly from GitHub. You can install it in your project via:

```bash
npm install github:d-marquina/CoppeliaSim-TypeScript-Client
```

## Prerequisites

1. You must have **CoppeliaSim** installed and running.
2. The scene must have the WebSocket Remote API server enabled (it usually is by default on port `23050`).

## Usage

### In Node.js (Scripts, CLI, Backend)

```typescript
import { RemoteAPIClient } from 'coppeliasim-ts-client';

async function main() {
    // 1. Initialize and connect
    const client = new RemoteAPIClient('localhost', 23050, { verbose: true });
    await client.connect();

    // 2. Load the 'sim' module (this builds the typed proxy)
    const sim = await client.require('sim');

    // 3. Call functions (returns are wrapped in arrays per the WS protocol)
    const [floorHandle] = await sim.getObject('/Floor');
    console.log('Floor handle:', floorHandle);

    // 4. Access constants directly
    console.log('Handle all constant:', sim.handle_all);

    // 5. Disconnect gracefully
    await client.disconnect();
}

main().catch(console.error);
```

### In a React/Web Environment

Because the library detects the environment automatically, you don't need any special configuration for the browser.

```tsx
import React, { useState, useEffect } from 'react';
import { RemoteAPIClient } from 'coppeliasim-ts-client';

export default function CoppeliaController() {
  const [client, setClient] = useState<RemoteAPIClient | null>(null);

  useEffect(() => {
    const initClient = async () => {
      const newClient = new RemoteAPIClient('localhost', 23050);
      await newClient.connect();
      setClient(newClient);
    };

    initClient();

    // Cleanup on unmount
    return () => {
      client?.disconnect();
    };
  }, []);

  const handleStart = async () => {
    if (!client) return;
    const sim = await client.require('sim');
    await sim.startSimulation();
  };

  return (
    <div>
      <h1>CoppeliaSim Web Controller</h1>
      <button onClick={handleStart} disabled={!client}>
        Start Simulation
      </button>
    </div>
  );
}
```

## How it Works under the hood

1. **`coppeliasim-api.d.ts`**: Contains over 8,000 lines of raw, synchronous API definitions extracted from CoppeliaSim.
2. **`remote-api.ts`**: Contains advanced TypeScript utilities (`AsyncApi<T>`) that map the synchronous definitions into async Promises wrapped in arrays, perfectly matching the WebSocket protocol specifications.
3. **`RemoteAPIClient.ts`**: Connects via WS, queries `wsRemoteApi.info`, and dynamically builds an object with functions that route to `client.call()`, injecting the proper types on the fly.


## License
MIT
