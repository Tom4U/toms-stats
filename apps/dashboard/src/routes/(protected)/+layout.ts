import { redirect } from '@sveltejs/kit'
import { get } from 'svelte/store'
import { authStore } from '$lib/auth.store.js'

export const ssr = false

export async function load(): Promise<void> {
  // Auth state is populated by onAuthStateChanged before this runs because
  // ssr=false and the store is initialised at module load in the browser.
  if (get(authStore) === null) {
    redirect(302, '/login')
  }
}
