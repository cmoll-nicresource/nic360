import { expect, it } from 'vitest'
import {
  signupChallenge,
  checkSignupCode,
  signupCompletionProof,
  validSignupProof,
} from './signupChallenge'
import { isCodeExpired } from './signupCode'
it('hashes codes, accepts a correct code and caps guessing attempts', () => {
  let stored = signupChallenge('012345')
  expect(stored).not.toContain('012345')
  expect(checkSignupCode(stored, '012345').valid).toBe(true)
  for (let i = 0; i < 5; i++) {
    const result = checkSignupCode(stored, '999999')
    expect(result.valid).toBe(false)
    stored = result.next!
  }
  expect(checkSignupCode(stored, '012345').valid).toBe(false)
  expect(checkSignupCode('bad', '012345').valid).toBe(false)
})
it('binds opaque completion proofs and rejects a code used as a proof', () => {
  const proof = signupCompletionProof()
  expect(validSignupProof(proof.stored, proof.token)).toBe(true)
  expect(validSignupProof(proof.stored, '0'.repeat(64))).toBe(false)
  expect(validSignupProof(signupChallenge('012345'), proof.token)).toBe(false)
  expect(validSignupProof(null, proof.token)).toBe(false)
  expect(isCodeExpired('invalid')).toBe(true)
})
