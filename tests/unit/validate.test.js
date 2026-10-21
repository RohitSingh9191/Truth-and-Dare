import { describe, it, expect } from 'vitest';
import { checkText, cleanText } from '../../shared/validate.js';

describe('text sent to us', () => {
  it('refuses contact details and links', () => {
    for (const bad of [
      'call me on 98765 43210',
      'my number is +91-98765-43210',
      'mail me at riya@example.com',
      'follow @riya.sharma',
      'see www.example.com',
      'https://bit.ly/abc',
      'join truthspin-clone.app now',
    ]) expect(checkText(bad, 200), bad).toBe('contact');
  });

  it('accepts normal questions in any language', () => {
    for (const ok of [
      'What is your funniest school memory?',
      'Dance for 20 seconds like nobody is watching.',
      'Aapko sabse zyada sharam kab aayi?',
      'Count backwards from 100 in steps of 7.',
      'सबसे मज़ेदार याद क्या है?',
      'Never have I ever missed a train by 2 minutes.',
    ]) expect(checkText(ok, 200), ok).toBeNull();
  });

  it('checks length', () => {
    expect(checkText('  ', 150)).toBe('empty');
    expect(checkText('x'.repeat(151), 150)).toBe('long');
  });

  it('cleans spaces', () => {
    expect(cleanText('  a   b \n c ')).toBe('a b c');
  });
});
