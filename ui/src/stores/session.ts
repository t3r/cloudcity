import { defineStore } from 'pinia'
import { ref } from 'vue';


export const SessionStore = defineStore('session', {
    state: () => ({
        id_token: null,
        access_token: null,
        expires_in: null,
        token_type: null,
        authenticated: ref(false),
    }),
    getters: {
    },
    actions: {
        logout(): void {
            this.id_token = null;
            this.access_token = null;
            this.expires_in = null;
            this.token_type = null;
            this.authenticated = false;
        },
        refresh(token: any) {
            this.id_token = token.id_token;
            this.access_token = token.access_token;
            this.expires_in = token.expires_in;
            this.token_type = token.token_type;
            this.authenticated = !!this.id_token;
        }
    },
})