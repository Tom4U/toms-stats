# Dashboard — Initialisation Required

The SvelteKit project needs to be scaffolded before development can start.
Run the following command from the repo root to initialise:

```bash
cd apps/dashboard
npx sv create . --template minimal --types ts --no-install
```

When prompted:

- Template: **minimal**
- Type checking: **TypeScript**
- Add-ons: select **Tailwind CSS** and **Vitest**

After scaffolding, delete this file.

The `package.json` in this folder already contains the correct dependencies;
merge any additions from the scaffold output if needed.
