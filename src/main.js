import { createApp } from 'vue'
import App from './App.vue'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap'
import router from './router'
import studentIcon from './assets/student_icon.png'

const link = document.createElement('link')
link.rel = 'icon'
link.href = studentIcon
document.head.appendChild(link)

const app = createApp(App)
app.use(router)
app.mount('#app')

