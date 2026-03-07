export default async function handler(req, res) {
    const { username } = req.query;

    try {
        const headers = process.env.GITHUB_TOKEN
            ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
            : {};

        const response = await fetch(`https://api.github.com/users/${username}`, { headers });

        const data = await response.json();

        res.status(response.status).json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch data from GitHub" });
    }
}