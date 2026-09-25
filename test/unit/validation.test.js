/**
 * Unit tests for validation utilities
 */

import { describe, test, expect } from '@jest/globals';
import { isValidEmail, validatePassword, validateRegistration } from '../../utils/validation.js';

describe('Validation Utilities', () => {
  describe('isValidEmail', () => {
    test('returns true for valid email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
    });
    
    test('returns false for invalid email', () => {
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
    });
  });
  
  describe('validatePassword', () => {
    test('returns valid for password with 6+ characters', () => {
      const result = validatePassword('password123');
      expect(result.valid).toBe(true);
    });
    
    test('returns invalid for short password', () => {
      const result = validatePassword('12345');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('at least 6 characters');
    });
    
    test('returns invalid for empty password', () => {
      const result = validatePassword('');
      expect(result.valid).toBe(false);
    });
  });
  
  describe('validateRegistration', () => {
    test('returns valid for correct registration data', () => {
      const data = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
        role: 'User'
      };
      
      const result = validateRegistration(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('returns errors for missing fields', () => {
      const data = {
        name: '',
        email: 'invalid',
        password: '123'
      };
      
      const result = validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    test('normalizes role to User or Admin', () => {
      // Test valid role normalization
      const data1 = {
        name: 'John',
        email: 'john@example.com',
        password: 'Password123!',
        role: 'user'
      };
      
      const result1 = validateRegistration(data1);
      expect(result1.valid).toBe(true);
      expect(result1.normalizedRole).toBe('User');
      
      // Test admin normalization
      const data2 = {
        name: 'John',
        email: 'john@example.com',
        password: 'Password123!',
        role: 'admin'
      };
      
      const result2 = validateRegistration(data2);
      expect(result2.valid).toBe(true);
      expect(result2.normalizedRole).toBe('Admin');
      
      // Test invalid role defaults to User
      const data3 = {
        name: 'John',
        email: 'john@example.com',
        password: 'Password123!',
        role: 'SuperAdmin'
      };
      
      const result3 = validateRegistration(data3);
      expect(result3.valid).toBe(false);
      expect(result3.errors.some(e => e.includes('Role'))).toBe(true);
    });
  });
});
