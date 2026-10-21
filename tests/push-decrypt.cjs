// Decifra um push "aes128gcm" (RFC 8291) com as chaves do aparelho falso dos
// testes: prova que o servidor cifrou e assinou a mensagem de verdade.
const crypto = require('crypto')

function createDevice() {
  const ecdh = crypto.createECDH('prime256v1')
  ecdh.generateKeys()
  const auth = crypto.randomBytes(16)
  return {
    ecdh,
    auth,
    p256dh: ecdh.getPublicKey().toString('base64url'),
    authKey: auth.toString('base64url'),
  }
}

const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest()

function decrypt(device, bodyBase64) {
  const body = Buffer.from(bodyBase64, 'base64')
  const salt = body.subarray(0, 16)
  const idLength = body[20]
  const serverKey = body.subarray(21, 21 + idLength)
  const content = body.subarray(21 + idLength)
  const secret = device.ecdh.computeSecret(serverKey)
  const devicePublic = device.ecdh.getPublicKey()
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), devicePublic, serverKey, Buffer.from([1])])
  const ikm = hmac(hmac(device.auth, secret), keyInfo)
  const prk = hmac(salt, ikm)
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16)
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12)
  const decipher = crypto.createDecipheriv('aes-128-gcm', cek, nonce)
  decipher.setAuthTag(content.subarray(content.length - 16))
  const padded = Buffer.concat([decipher.update(content.subarray(0, content.length - 16)), decipher.final()])
  const end = padded.lastIndexOf(2)
  return JSON.parse(padded.subarray(0, end).toString('utf8'))
}

// Script injetado na página: PushManager falso que entrega no mock (o
// Chromium de teste não tem serviço de push).
function fakePushScript({ endpoint, p256dh, auth }) {
  return `(() => {
    const flag = '__tj_fake_push__'
    let stored = null
    const make = (key) => ({
      endpoint: ${JSON.stringify(endpoint)},
      expirationTime: null,
      options: { applicationServerKey: key, userVisibleOnly: true },
      toJSON() { return { endpoint: this.endpoint, expirationTime: null, keys: { p256dh: ${JSON.stringify(p256dh)}, auth: ${JSON.stringify(auth)} } } },
      async unsubscribe() { stored = null; localStorage.removeItem(flag); return true },
    })
    // O Chromium sem janela sempre responde "denied" para notificações.
    if (typeof Notification !== 'undefined') {
      const permission = '__tj_fake_permission__'
      Object.defineProperty(Notification, 'permission', { configurable: true, get: () => localStorage.getItem(permission) || 'default' })
      Notification.requestPermission = async () => {
        localStorage.setItem(permission, 'granted')
        return 'granted'
      }
    }
    if (typeof PushManager !== 'undefined') {
      PushManager.prototype.subscribe = async function (options) {
        stored = make(options.applicationServerKey)
        localStorage.setItem(flag, '1')
        return stored
      }
      PushManager.prototype.getSubscription = async function () {
        if (!stored && localStorage.getItem(flag)) stored = make(null)
        return stored
      }
    }
  })()`
}

module.exports = { createDevice, decrypt, fakePushScript }
