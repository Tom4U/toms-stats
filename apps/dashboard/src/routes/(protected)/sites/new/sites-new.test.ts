import { describe, it, expect } from 'vitest';

// Hostname validation logic extracted inline for unit testing
function isValidHostname(value: string): boolean {
	return /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(value);
}

describe('site domain validation', () => {
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
		expect(isValidHostname('192.168.1.1')).toBe(false);
	});
});
