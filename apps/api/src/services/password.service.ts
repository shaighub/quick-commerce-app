import bcrypt from 'bcrypt';

/** NFR-SEC-01. Cost stays in code so an env override cannot weaken it. */
export const BCRYPT_COST = 12;

export interface PasswordService {
  hash(password: string): Promise<string>;
  verify(password: string, passwordHash: string): Promise<boolean>;
  /** Spends a bcrypt compare when the email is unknown so login timing stays even. */
  verifyUnknown(password: string): Promise<void>;
}

export function createPasswordService(): PasswordService {
  let dummyHash: Promise<string> | undefined;

  function dummy(): Promise<string> {
    dummyHash ??= bcrypt.hash('not-a-real-password', BCRYPT_COST);
    return dummyHash;
  }

  return {
    hash(password: string): Promise<string> {
      return bcrypt.hash(password, BCRYPT_COST);
    },
    verify(password: string, passwordHash: string): Promise<boolean> {
      return bcrypt.compare(password, passwordHash);
    },
    async verifyUnknown(password: string): Promise<void> {
      await bcrypt.compare(password, await dummy());
    },
  };
}
