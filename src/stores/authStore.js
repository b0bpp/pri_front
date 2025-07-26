import { reactive } from 'vue';
import Cookies from 'js-cookie';

const AUTH_KEY = 'authState';

const loadAuthState = () => {
  const savedState = Cookies.get(AUTH_KEY);
  return savedState
    ? JSON.parse(savedState)
    : { isPromoter: false, userId: null, fname: '', lname: '' };
};

const authStore = reactive(loadAuthState());

authStore.setUser = (isPromoter, userId, f_name, l_name) => {
  authStore.isPromoter = isPromoter;
  authStore.userId = userId;
  authStore.fname = f_name;
  authStore.lname = l_name;
  Cookies.set(AUTH_KEY, JSON.stringify({ isPromoter, userId, f_name, l_name }), { expires: 7 });
};

authStore.logout = () => {
  authStore.isPromoter = false;
  authStore.userId = null;
  authStore.fname = '';
  authStore.lname = '';
  Cookies.remove(AUTH_KEY);
};

export default authStore;