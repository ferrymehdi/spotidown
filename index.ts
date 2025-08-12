import { serve } from "bun";
import puppeteer, { Browser, Page } from "puppeteer";

const PORT = 3045;

let browser: Browser | null = null;
let page: Page | null = null;

// Launch browser and page ONCE
async function initBrowserAndPage() {
  if (!browser) browser = await puppeteer.launch({ headless: true });
  if (!page) {
    page = await browser.newPage();
    await page.goto("https://spotidown.app/", { waitUntil: "networkidle2" });
  }
}

// Refresh the page every 5 minutes to keep session fresh
setInterval(
  async () => {
    if (page) {
      try {
        await page.goto("https://spotidown.app/", {
          waitUntil: "networkidle2",
        });
        console.log("Spotidown page refreshed!");
      } catch (e) {
        console.error("Failed to refresh page:", e);
      }
    }
  },
  5 * 60 * 1000,
); // 5 minutes

function extractTrackFormFields(html: string) {
  const dataMatch = html.match(/name="data" value='([^']+)'/);
  const baseMatch = html.match(/name="base" value="([^"]+)"/);
  const tokenMatch = html.match(/name="token" value="([^"]+)"/);
  if (!dataMatch || !baseMatch || !tokenMatch)
    throw new Error("No download form fields found");
  return {
    data: dataMatch[1] || "",
    base: baseMatch[1] || "",
    token: tokenMatch[1] || "",
  };
}

async function getDownloadUrl(
  trackId: string,
): Promise<{ url: string; name: string; artist: string }> {
  await initBrowserAndPage();
  if (!page) throw new Error("Page not initialized");

  // Fill the input field with the Spotify track URL
  await page.evaluate((id: string) => {
    const input = document.querySelector<HTMLInputElement>('input[name="url"]');
    if (input) input.value = `https://open.spotify.com/track/${id}`;
  }, trackId);

  // Run reCAPTCHA and fill hidden field
  const recaptchaToken = await page.evaluate(() => {
    // @ts-ignore
    return new Promise<string>((resolve) => {
      // @ts-ignore
      grecaptcha.ready(function () {
        // @ts-ignore
        grecaptcha
          .execute("6LcXkaUqAAAAAGvO0z9Mg54lpG22HE4gkl3XYFTK", {
            action: "submit",
          })
          .then((token: string) => resolve(token));
      });
    });
  });

  await page.evaluate((token: string) => {
    const input = document.querySelector<HTMLInputElement>(
      'input[name="g-recaptcha-response"]',
    );
    if (input) input.value = token;
  }, recaptchaToken);

  // Gather all form fields from the page into FormData
  const formDataEntries = await page.evaluate(() => {
    const form = document.forms.namedItem("spotifyurl");
    const fd = new FormData(form as HTMLFormElement);
    const entries: { name: string; value: string }[] = [];
    for (const [name, value] of fd.entries()) {
      entries.push({ name, value: typeof value === "string" ? value : "" });
    }
    return entries;
  });

  // Submit the main form to /action (inside Puppeteer)
  const responseText = await page.evaluate(
    (entries: { name: string; value: string }[]) => {
      const form = new FormData();
      entries.forEach(({ name, value }) => form.append(name, value));
      return fetch("/action", {
        method: "POST",
        body: form,
        credentials: "include",
      }).then((res) => res.text());
    },
    formDataEntries,
  );

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error("Invalid JSON from Spotidown");
  }
  if (data.error || !data.data) {
    throw new Error(data.message || "Spotidown returned error");
  }

  // Extract /action/track form fields from returned HTML
  const trackForm = extractTrackFormFields(data.data);

  // Validate form fields before using
  if (!trackForm.data || !trackForm.base || !trackForm.token) {
    throw new Error("Missing one or more required trackForm fields");
  }

  // Submit second request to /action/track inside Puppeteer (using FormData)
  const trackResponseText = await page.evaluate((trackForm) => {
    if (!trackForm.data || !trackForm.base || !trackForm.token) {
      throw new Error("Missing one or more required trackForm fields");
    }
    const form = new FormData();
    form.append("data", trackForm.data);
    form.append("base", trackForm.base);
    form.append("token", trackForm.token);

    return fetch("/action/track", {
      method: "POST",
      body: form,
      credentials: "include",
    }).then((res) => res.text());
  }, trackForm);

  let trackData: any;
  try {
    trackData = JSON.parse(trackResponseText);
  } catch (e) {
    throw new Error("Invalid JSON from Spotidown track API");
  }
  if (trackData.error || !trackData.data) {
    throw new Error(trackData.message || "Spotidown track returned error");
  }

  // Extract final download URL from HTML response
  const urlMatch = trackData.data.match(
    /href="(https:\/\/rapid\.spotidown\.app\/\?token=[^"]+)"/,
  );
  if (!urlMatch) {
    throw new Error("Could not find MP3 download url in Spotidown response");
  }
  const downloadUrl = urlMatch[1];

  // Optional: Extract name/artist from HTML
  let name = "Unknown";
  let artist = "";
  const nameMatch = trackData.data.match(/title="([^"]+)"/);
  if (nameMatch) name = nameMatch[1];
  const artistMatch = trackData.data.match(/<p><span>([^<]+)<\/span><\/p>/);
  if (artistMatch) artist = artistMatch[1];

  return { url: downloadUrl, name, artist };
}

serve({
  port: PORT,
  fetch: async (req) => {
    const url = new URL(req.url);
    if (url.pathname === "/track") {
      const trackId = url.searchParams.get("q");
      if (!trackId) {
        return new Response(
          JSON.stringify({ error: true, message: "Missing 'q' parameter" }),
          { status: 400 },
        );
      }
      try {
        const {
          url: downloadUrl,
          name,
          artist,
        } = await getDownloadUrl(trackId);
        return new Response(
          JSON.stringify({ error: false, url: downloadUrl, name, artist }),
          {
            headers: { "content-type": "application/json" },
          },
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: true, message: err.message }),
          { status: 500 },
        );
      }
    }
    return new Response("Not found", { status: 404 });
  },
});

initBrowserAndPage()
  .then(() =>
    console.log(`Spotidown proxy server running at http://localhost:${PORT}`),
  )
  .catch((e) => {
    console.error("Failed to initialize browser/page", e);
    process.exit(1);
  });
