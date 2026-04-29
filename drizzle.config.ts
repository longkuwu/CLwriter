import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './src/lib/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url: 'postgres://localhost:5432/ip-architect', // Dummy URL for compilation/generation only
    },
});
