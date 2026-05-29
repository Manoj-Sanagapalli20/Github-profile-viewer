export default async function handler(req, res) {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ error: "Username is required" });
    }

    try {
        const response = await fetch(`https://github.com/users/${username}/contributions`);
        
        if (!response.ok) {
            return res.status(response.status).json({ error: `GitHub returned status ${response.status}` });
        }

        const html = await response.text();

        // Enable Vercel Edge caching to prevent rate limiting and maximize speed
        // caches response for 10 minutes (600 seconds)
        res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=600');
        res.setHeader('Content-Type', 'text/html');
        
        return res.status(200).send(html);
    } catch (error) {
        return res.status(500).json({ error: "Failed to fetch contribution data" });
    }
}
