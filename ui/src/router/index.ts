import { createRouter, createWebHistory, type RouteLocationNormalizedGeneric, type NavigationGuardNext } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import { SessionStore } from '@/stores/session'

const getTokenFromHash = (to: RouteLocationNormalizedGeneric, from: RouteLocationNormalizedGeneric, next: NavigationGuardNext) => {
  if (to.hash) {
    const sessionStore = SessionStore();

    const parsedHash = new URLSearchParams(
      to.hash.substring(1)
    );

    let token = {
      id_token: parsedHash.get('id_token'),
      access_token: parsedHash.get('access_token'),
      expires_in: parsedHash.get('expires_in'),
      token_type: parsedHash.get('token_type'),
    }

    sessionStore.refresh(token);

    next({ path: to.path, replace: true });
  } else {
    next();
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      beforeEnter: getTokenFromHash,
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/AboutView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      redirect: '',
      beforeEnter: (to, from, next) => {
        // window.location.href = '/api/login'
        window.location.href =
        'https://cloudcity.auth.eu-central-1.amazoncognito.com/oauth2/authorize?client_id=4lh4mq2otu39r38ejoldqa1g02&response_type=token&scope=aws.cognito.signin.user.admin+email+openid+phone+profile&redirect_uri=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Fcallback'
      }
    },
    {
      path: '/auth/callback',
      name: 'callback',
      redirect: '/',
      beforeEnter: getTokenFromHash,

    }
  ]
});

export default router;