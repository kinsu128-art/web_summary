export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
};
