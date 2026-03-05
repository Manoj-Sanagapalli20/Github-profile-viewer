export default async function handler(req, res) {
  const { username } = req.query;

  try {
    const response = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=10&sort=updated`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
