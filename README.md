# Spotidown Proxy Server

A Bun-based proxy API server for downloading Spotify tracks using [spotidown.app](https://spotidown.app/). This project uses Puppeteer to automate form submission and fetch MP3 download links, and the [spotify-web-api-node](https://github.com/thelinmichael/spotify-web-api-node) for ISRC-based track lookup.

## Features

- **Spotify Track Download**: Get direct MP3 download links for Spotify tracks by their track ID.
- **ISRC Lookup**: Search for Spotify tracks using ISRC codes and fetch their download links.
- **Automated Session Management**: The server uses Puppeteer to keep an active session with Spotidown and refreshes it periodically.
- **REST API**: Simple HTTP endpoints for integration.

## API Endpoints

### Download by Spotify Track ID

**GET `/track/:id`**

Redirects to the MP3 download URL for the given Spotify track ID.

**Example:**
```http
GET /track/1VdLGQ8r0fA2QzjWbJf2G7
```
Response: HTTP 302 Redirect to download URL.

### Download by ISRC Code

**GET `/isrc/:isrc`**

Searches Spotify for a track matching the given ISRC, then redirects to the MP3 download URL.

**Example:**
```http
GET /isrc/USUM71703861
```
Response: HTTP 302 Redirect to download URL.

## How It Works

- Uses Puppeteer to interact with [spotidown.app](https://spotidown.app/) in a headless browser.
- Submits the Spotify track URL, runs the reCAPTCHA, and collects form data needed for download.
- Extracts the final MP3 download link from Spotidown's server response.
- For ISRC lookups, uses Spotify's API to resolve the track ID.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [Node.js](https://nodejs.org/) (for Puppeteer and Spotify API)
- [Puppeteer](https://pptr.dev/)
- [spotify-web-api-node](https://github.com/thelinmichael/spotify-web-api-node)

### Installation

```bash
bun install
```

### Running the Server

```bash
bun run index.ts
```

Server will start at `http://localhost:3045`.

## Environment

No API keys required for Spotidown, but your server will use Bun, Puppeteer, and Spotify's public API credentials.

## Notes

- **ReCAPTCHA Handling**: The server uses Spotidown's public reCAPTCHA site key and executes the challenge automatically.
- **Session Refresh**: The Spotidown page is refreshed every 5 minutes to maintain a valid session.
- **Rate Limits**: Excessive usage may trigger Spotidown or Spotify rate limits.

## License

MIT

## Disclaimer

This repository is for educational purposes only. Downloading copyrighted material without permission may violate Spotify's Terms of Service and/or local laws. Use responsibly.

## Credits

- [spotidown.app](https://spotidown.app/)
- [spotify-web-api-node](https://github.com/thelinmichael/spotify-web-api-node)
- [Puppeteer](https://pptr.dev/)
- [Bun](https://bun.sh/)
