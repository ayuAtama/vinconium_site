import { serve } from '@hono/node-server'
import { Hono } from "hono";
import { cors } from 'hono/cors'
import { SyasymServer } from "syasym";
import { EpKey } from "syasym/dist/types";
import { addUser, getUser, hasUser, updateSecurity } from "./database";

const { generateChallenge, verifyChallenge, verifyRequest } = SyasymServer

const app = new Hono();
const port = 4000;

const usedNonces = new Map<string, number>()
const challengeStore = new Map<string, { challenge: any, timestamp: number, nonce: string }>()

setInterval(() => {
    const now = Date.now()
    for (const [nonce, timestamp] of usedNonces.entries()) {
        if (now - timestamp > 300000) {
            usedNonces.delete(nonce)
        }
    }
    for (const [username, data] of challengeStore.entries()) {
        if (now - data.timestamp > 300000) {
            challengeStore.delete(username)
        }
    }
}, 300000)

const rateLimitStore = new Map<string, { count: number, resetTime: number }>()

function rateLimit(key: string, limit: number = 5, windowMs: number = 900000): boolean {
    const now = Date.now()
    const record = rateLimitStore.get(key)
    
    if (!record || now > record.resetTime) {
        rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
        return true
    }
    
    if (record.count >= limit) {
        return false
    }
    
    record.count++
    rateLimitStore.set(key, record)
    return true
}

app.use('*', cors({
    origin: 'http://localhost:3000',
    allowHeaders: ['Origin', 'Content-Type', 'Authorization', 'x-user-id', 'x-timestamp', 'x-signature'],
    allowMethods: ['GET', 'OPTIONS', 'POST', 'PUT', 'DELETE'],
    credentials: false
}))

app.get("/", (c) => {
    return c.text("Hello from the authentication server!")
});

app.post("/signup", async (c) => {
    const clientIp = c.req.header('x-forwarded-for') || 'unknown'
    if (!rateLimit(clientIp, 3, 60000)) {
        c.status(429)
        return c.json({ message: "Too many signup attempts. Try again later." })
    }

    const { name, username, pubKey, epKey } = await c.req.json();

    if(!name || !username || !pubKey || !epKey){
        c.status(409)
        return c.json({ message: "Something wrong, I can feel it!" })
    }
    if(await hasUser(username)){
        c.status(409)
        return c.json({ message: "Username already exists!" })
    }

    const user = await addUser({
        username: username as string,
        pubKey: pubKey as string,
        epKey: epKey as EpKey,
        name: name as string,
        xp: 0,
        coin: 0
    })

    if(user) return c.json({ message: "User registered successfully!" });

    return c.json({ message: "Register failed, contact an admin. " });
});

app.get("/get-challenge", async (c) => {
    const clientIp = c.req.header('x-forwarded-for') || 'unknown'
    if (!rateLimit(clientIp, 10, 60000)) {
        c.status(429)
        return c.json({ message: "Too many requests. Try again later." })
    }

    const { username } = c.req.query();

    const user = await getUser(username as string)

    if(user){
        const nonce = Math.random().toString(36).substring(2, 15) + Date.now().toString()
        const challenge = generateChallenge(user.username, user.pubKey, user.epKey)
        
        challengeStore.set(username as string, {
            challenge: challenge,
            timestamp: Date.now(),
            nonce: nonce
        })
        
        console.log(`Challenge generated for user: ${username} at ${new Date().toISOString()}`)
        
        return c.json({ ...challenge, nonce: nonce, timestamp: Date.now() });
    }

    c.status(404)
    return c.json({ message: "User not found!" });
});

app.post("/signin", async (c) => {
    const clientIp = c.req.header('x-forwarded-for') || 'unknown'
    if (!rateLimit(clientIp, 5, 900000)) {
        c.status(429)
        return c.json({ message: "Too many login attempts. Try again later." })
    }

    const { username, signature, nonce, timestamp } = await c.req.json();

    if (!nonce || !timestamp) {
        c.status(400)
        return c.json({ message: "Missing nonce or timestamp" })
    }

    const now = Date.now()
    if (now - timestamp > 300000) {
        c.status(401)
        return c.json({ message: "Challenge expired. Please request a new one." })
    }

    if (usedNonces.has(nonce)) {
        c.status(401)
        return c.json({ message: "Challenge already used. Replay attack detected." })
    }

    if(!await hasUser(username)){
        c.status(404)
        return c.json({ message: "User not found!" });
    }

    const storedData = challengeStore.get(username)
    
    if (!storedData || storedData.nonce !== nonce) {
        c.status(401)
        return c.json({ message: "Invalid or expired challenge nonce." })
    }

    const isValid = verifyChallenge(username, signature)
        
    if(!isValid){
        c.status(401)
        return c.json({ message: "Invalid signature!" });
    }

    usedNonces.set(nonce, now)
    challengeStore.delete(username)

    console.log(`User logged in: ${username} at ${new Date().toISOString()}`)

    return c.json({ message: "User logged in successfully!" });
});

app.post("/update-keys", async (c) => {
    const clientIp = c.req.header('x-forwarded-for') || 'unknown'
    if (!rateLimit(clientIp, 3, 60000)) {
        c.status(429)
        return c.json({ message: "Too many update attempts. Try again later." })
    }

    const username = await c.req.header('x-user-id')
    if(!username){
        c.status(400)
        return c.json({ message: 'Missing user-id header' })
    }

    const user = await getUser(username)
    if(!user){
        c.status(404)
        return c.json({ message: 'User not found' })
    }
    
    const valid = await verifyRequest(user.pubKey, {
        body: JSON.parse(await c.req.text() || '{}'),
        headers: c.req.header(),
        method: c.req.method,
        path: c.req.path
    })

    if(valid == 0){
        c.status(401)
        return c.json({ message: 'Request Expired' })
    }
    if(valid == 1){
        c.status(401)
        return c.json({ message: 'Invalid Signature' })
    }
    
    const { newPubKey, newEpKey } = await c.req.json()
    
    if(!newPubKey || !newEpKey){
        c.status(400)
        return c.json({ message: 'Missing newPubKey or newEpKey' })
    }
    
    const updatedUser = await updateSecurity(username, newPubKey, newEpKey)
    
    if(!updatedUser){
        c.status(500)
        return c.json({ message: 'Failed to update keys' })
    }
    
    console.log(`Keys updated for user: ${username} at ${new Date().toISOString()}`)
    
    return c.json({ message: 'Keys updated successfully!', user: updatedUser })
})

app.post("/get-user", async (c) => {
    const clientIp = c.req.header('x-forwarded-for') || 'unknown'
    if (!rateLimit(clientIp, 20, 60000)) {
        c.status(429)
        return c.json({ message: "Too many requests. Try again later." })
    }

    const username = await c.req.header('x-user-id')
    if(!username){
        c.status(404)
        return c.json({ message: 'Input Username Empty' })
    }

    const user = await getUser(username)
    if(!user){
        c.status(404)
        return c.json({ message: 'User Not Found' })
    }
    
    const valid = await verifyRequest(user.pubKey, {
        body: JSON.parse(await c.req.text() || '{}'),
        headers: c.req.header(),
        method: c.req.method,
        path: c.req.path
    })

    if(valid == 0){
        c.status(401)
        return c.json({ message: 'Request Expired' })
    }
    if(valid == 1){
        c.status(401)
        return c.json({ message: 'Invalid Signature' })
    }
    
    return c.json({ message: 'Request Accepted!', user: user})
})

serve({
    fetch: app.fetch,
    port: port
}, () => {
    console.log('Listening on', port)
})
