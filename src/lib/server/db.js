import { MongoClient } from 'mongodb';
import { env } from '$env/dynamic/private';

// Local fallback or process.env (SvelteKit env covers it)
const uri = env.MONGODB_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017';

const options = {};

/** @type {MongoClient} */
let client;
/** @type {Promise<MongoClient>} */
let clientPromise;

if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    // @ts-ignore
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri, options);
        // @ts-ignore
        global._mongoClientPromise = client.connect();
    }
    // @ts-ignore
    clientPromise = global._mongoClientPromise;
} else {
    // In production mode, it's best to not use a global variable.
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
}

/** 
 * Get the posts collection synchronously for simpler migration scripts, 
 * but for SvelteKit server functions, await getDb() is better. 
 */
export async function getPostsCollection() {
    const db = await getDb();
    return db.collection('posts');
}

export async function getDb() {
    const connectedClient = await clientPromise;
    return connectedClient.db('insightroom');
}

export default clientPromise;
