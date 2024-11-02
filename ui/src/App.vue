<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { storeToRefs } from 'pinia'

import { SessionStore } from '@/stores/session'
// Get the session store
const sessionStore = SessionStore()
// Use storeToRefs to maintain reactivity of store properties
const { authenticated } = storeToRefs(sessionStore)
</script>

<template>
  <nav class="navbar navbar-expand-lg bg-body-tertiary">
  <div class="container-fluid">
    <a class="navbar-brand" href="/">CloudCity</a>
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
      <span class="navbar-toggler-icon"></span>
    </button>
    <div class="collapse navbar-collapse" id="navbarSupportedContent">
      <ul class="navbar-nav me-auto mb-2 mb-lg-0">
          <li class="nav-item">
          <a class="nav-link" href="/">Status (map)</a>
        </li>
        <li class="nav-item">
          <RouterLink class="nav-link" to="about">About</RouterLink>
        </li>
        <li class="nav-item" v-if="!authenticated">
          <RouterLink class="nav-link" to="login">Login</RouterLink>
        </li>
        <li class="nav-item" v-if="authenticated">
          <a class="nav-link" href="#" @click.prevent="sessionStore.logout">Logout</a>
        </li>
        <!--li class="nav-item">
          <a class="nav-link disabled" aria-disabled="true">Disabled</a>
        </li-->
      </ul>

    </div>
  </div>
</nav>
  <RouterView />
</template>
