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

/** `DRY_RUN`, the one variable shared code reads in every Lambda (dry-run.utils.ts). */
const sharedSpecs = {
  // local `npm run invoke:dry` only, see dry-run.utils.ts. Only the exact string `true` turns writes off (not
  // envalid's `bool()`, which also takes `1`/`yes`/`on`), so a stray value on a live function fails at init instead
  DRY_RUN: str({ choices: ['true', 'false'], default: 'false' }),
};

/**
 * The shared environment variables, validated once at cold start when this module loads. Anything else shared code
 * needs, such as a function name or webhook URL, is passed in by the Lambda.
 */
export const sharedEnv = cleanEnv(process.env, sharedSpecs, { reporter });

/**
 * Validates the Lambda's own environment variables (`specs`) together with `DRY_RUN` once at cold start, in one
 * `cleanEnv` call so envalid's accessor guard (reading an undeclared variable throws) stays in place. Call it once,
 * from the Lambda's `src/env.ts`.
 */
export function cleanLambdaEnv<S extends object>(specs: S) {
  return cleanEnv(process.env, { ...sharedSpecs, ...specs }, { reporter });
}
