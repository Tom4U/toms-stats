/** Returns true if value is a valid hostname (e.g. example.com, blog.example.com). */
export function isValidHostname(value: string): boolean {
	return /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(value);
}
