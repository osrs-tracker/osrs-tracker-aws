import { bool, cleanEnv, EnvError, EnvMissingError, makeValidator, str } from 'envalid';

/** A string that is set and not empty (envalid's `str()` accepts an empty string). */
const nonEmptyStr = makeValidator<string>((input) => {
  if (!input) throw new EnvError('Empty');
  return input;
});

/**
 * The environment variables this Lambda reads, validated once at cold start. A missing or invalid variable throws at
 * module load with an error naming it (never its value), so the invocation fails at init instead of misbehaving later.
 */
export const env = cleanEnv(
  process.env,
  {
    MONGODB_URI: nonEmptyStr(),
    MONGODB_DATABASE: nonEmptyStr(),
    MONGODB_COLLECTION: nonEmptyStr(),
    // local SCRAM only (an Atlas database user); unset in production, which uses MONGODB-AWS
    MONGODB_USERNAME: str({ default: undefined }),
    MONGODB_PASSWORD: str({ default: undefined }),
    // local `npm run invoke:dry` only, see dry-run.utils.ts
    DRY_RUN: bool({ default: false }),
  },
  {
    reporter: ({ errors }) => {
      const problems = Object.entries(errors).map(
        ([name, error]) => `${name} (${error instanceof EnvMissingError ? 'missing' : 'invalid'})`,
      );
      if (problems.length) throw new Error(`Invalid environment variables: ${problems.join(', ')}`);
    },
  },
);
