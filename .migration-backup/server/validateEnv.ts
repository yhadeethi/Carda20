/**
 * Validates that all required environment variables are set
 * Throws an error if any required variables are missing
 */

interface RequiredEnvVars {
  DATABASE_URL: string;
  SESSION_SECRET: string;
  REPL_ID: string;
}

interface OptionalEnvVars {
  AI_INTEGRATIONS_OPENAI_API_KEY?: string;
  AI_INTEGRATIONS_OPENAI_BASE_URL?: string;
  HUBSPOT_CLIENT_ID?: string;
  HUBSPOT_CLIENT_SECRET?: string;
  ISSUER_URL?: string;
  NODE_ENV?: string;
  PORT?: string;
}

export function validateEnvironmentVariables(): void {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  const required: (keyof RequiredEnvVars)[] = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'REPL_ID',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // Check for empty SESSION_SECRET
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
    warnings.push('SESSION_SECRET should be at least 32 characters for security');
  }

  // Check optional but important variables
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    warnings.push('AI_INTEGRATIONS_OPENAI_API_KEY is not set - AI features will not work');
  }

  if (!process.env.HUBSPOT_CLIENT_ID || !process.env.HUBSPOT_CLIENT_SECRET) {
    warnings.push('HubSpot credentials not set - HubSpot integration will not work');
  }

  // Throw if missing required vars
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}\n\n` +
      `Please set these variables in your .env file or environment.`
    );
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn('⚠️  Environment variable warnings:');
    warnings.forEach(w => console.warn(`   ${w}`));
    console.warn('');
  }

  console.log('✓ Environment variables validated');
}
