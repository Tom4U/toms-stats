import { describe, it, expect } from 'vitest';
import { isValidHostname } from '$lib/validation.js';

describe('isValidHostname', () => {
	it('accepts a simple hostname', () => {
		expect(isValidHostname('example.com')).toBe(true);
	});

	it('accepts a subdomain', () => {
		expect(isValidHostname('blog.example.com')).toBe(true);
	});

	it('rejects a URL with protocol', () => {
		expect(isValidHostname('https://example.com')).toBe(false);
	});

	it('rejects an empty string', () => {
		expect(isValidHostname('')).toBe(false);
	});

	it('rejects a hostname without TLD', () => {
		expect(isValidHostname('localhost')).toBe(false);
	});

	it('rejects a bare IP address', () => {
		// NOSONAR: test-only value to verify that IP addresses are rejected by the hostname validator
		expect(isValidHostname('192.0.2.1')).toBe(false); // RFC 5737 documentation range
	});

	it('accepts a domain after trimming surrounding whitespace', () => {
		expect(isValidHostname(' example.com '.trim())).toBe(true);
	});
});
