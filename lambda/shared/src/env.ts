import { cleanEnv, EnvError, EnvMissingError, makeValidator, str } from 'envalid';

/** A string that is set and not empty (envalid's `str()` accepts an empty string). */
export const nonEmptyStr = /* @__PURE__ */ makeValidator<string>((input) => {
  if (!input) throw new EnvError('Empty');
  return input;
});

/** A whole number of at least 1. */
export const positiveInt = /* @__PURE__ */ makeValidator<number>((input) => {
  const value = Number(input);
  if (!Number.isInteger(value) || value < 1) throw new EnvError('Not a positive integer');
  return value;
});

/** Throws one error naming every missing or invalid variable, never its value (envalid's default prints values). */
const reporter = ({ errors }: { errors: Partial<Record<string, Error>> }) => {
  const problems = Object.entries(errors).map(
    ([name, error]) => `${name} (${error instanceof EnvMissingError ? 'missing' : 'invalid'})`,
  );
  if (problems.length) throw new Error(`Invalid environment variables: ${problems.join(', ')}`);
};

/** The environment variables the shared code reads: MongoDB and `DRY_RUN`. */
const sharedSpecs = {
  MONGODB_URI: nonEmptyStr(),
  MONGODB_DATABASE: nonEmptyStr(),
  MONGODB_COLLECTION: nonEmptyStr(),
  // local SCRAM only (an Atlas database user); unset in production, which uses MONGODB-AWS
  MONGODB_USERNAME: str({ default: undefined }),
  MONGODB_PASSWORD: str({ default: undefined }),
  // local `npm run invoke:dry` only, see dry-run.utils.ts. Only the exact string `true` turns writes off (not
  // envalid's `bool()`, which also takes `1`/`yes`/`on`), so a stray value on a live function fails at init instead
  DRY_RUN: str({ choices: ['true', 'false'], default: 'false' }),
};

/**
 * The shared environment variables, validated once at cold start when this module loads. Anything else shared code
 * needs, such as a queue or webhook URL, is passed in by the Lambda.
 */
export const sharedEnv = cleanEnv(process.env, sharedSpecs, { reporter });

// SCRAM needs both. A username alone would fail later with a driver auth error that doesn't name the variable
if (sharedEnv.MONGODB_USERNAME && !sharedEnv.MONGODB_PASSWORD)
  throw new Error('Invalid environment variables: MONGODB_PASSWORD (missing, required with MONGODB_USERNAME)');

/**
 * Validates the Lambda's own environment variables (`specs`) together with the shared ones once at cold start, in one
 * `cleanEnv` call so envalid's accessor guard (reading an undeclared variable throws) stays in place. Call it once,
 * from the Lambda's `src/env.ts`.
 */
export function cleanLambdaEnv<S extends object>(specs: S) {
  return cleanEnv(process.env, { ...sharedSpecs, ...specs }, { reporter });
}
