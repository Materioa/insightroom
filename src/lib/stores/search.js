import { writable } from 'svelte/store';

export const searchTerm = writable('');
export const showSearchBoxStore = writable(false);
