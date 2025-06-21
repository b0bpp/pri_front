import { reactive } from 'vue';

     const authStore = reactive({
       isPromoter: false,
       userId: null,
       setUser(isPromoter, userId) {
         this.isPromoter = isPromoter;
         this.userId = userId;
       }
     });

     export default authStore;