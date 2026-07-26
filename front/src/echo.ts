import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

// Reverb speaks the Pusher protocol, so Echo's pusher connector is reused here.
;(window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher

export const echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY,
  wsHost: import.meta.env.VITE_REVERB_HOST ?? '127.0.0.1',
  wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 6001),
  wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 6001),
  forceTLS: false,
  enabledTransports: ['ws', 'wss'],
})
