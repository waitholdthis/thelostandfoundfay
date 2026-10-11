# Connecting the website to a Google Sheet

This takes about 10 minutes, and you only do it once. Afterward, everything is updated from the
**Shoppe Office**: open `admin.html` on the website (for example
`https://yoursite.com/admin.html`), from a phone or a computer:

- add **New Finds** with a photo straight from your phone's camera
- set the **Drawer of the Day**
- update the **St. Jude** running total
- choose **this week's corner** on the shop map
- approve **Lost Board** cards and stamp them **found** (the shopper is emailed automatically)

Everything is also visible, and editable, in the Google Sheet itself.

## 1. Create the Sheet

1. Sign in to the shoppe's Google account and create a new blank Google Sheet.
   Name it **Lost and Found Website**.
2. In the Sheet, open **Extensions → Apps Script**.
3. Delete everything in the editor, then paste in the whole of `Code.gs` from this folder.
4. Press the **Save** icon.

## 2. Run the one-time setup

1. In the toolbar's function menu, choose **setup**, then press **Run**.
2. Google asks for permission. Choose the shoppe's account → **Advanced** →
   **Go to (project name)** → **Allow**. The script needs this to:
   - read and update the Sheet
   - save photos to a Drive folder called **Lost and Found Website Photos**
   - email you about new Lost Board cards, and email shoppers when their item is found
3. Go back to the Sheet. You'll see five tabs: **New Finds**, **Drawer of the Day**,
   **St Jude Total**, **Shop Map** and **Lost Board**.
4. Check the shoppe's email for **"Your Shoppe Office passcode."** It looks like
   `K7PM-4XQ2-HB9T`. Keep it private. Anyone with it can change the website.

## 3. Publish it for the website

1. In Apps Script, click **Deploy → New deployment**.
2. Click the gear ⚙ next to "Select type" and choose **Web app**.
3. Set **Execute as: Me** and **Who has access: Anyone**.
4. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
5. Open `js/config.js` in the website and paste it between the quotes:
   `sheetApi: "https://script.google.com/macros/s/…/exec",`
6. Open `admin.html`, enter the passcode, and you're in.

"Anyone" lets the website read the public parts of the Sheet. Changes need the passcode, and
shoppers' email addresses are never sent to the public website.

> If you change `Code.gs` later, use **Deploy → Manage deployments → Edit →
> Version: New version** so the website URL stays the same.

## Good to know

- **Lost the passcode, or want to change it?** In Apps Script, choose **resetPasscode** and press
  **Run**. A new one is emailed and the old one stops working.
- **Too many wrong passcodes** lock the Shoppe Office for 15 minutes.
- **Photos** are shrunk on your phone before uploading, so they're quick even on mobile data.
  They're stored in your Google Drive and shared as "anyone with the link can view," which is
  how the website can show them.
- **The website shows the six newest finds** that are set to "show." Hide older ones, or
  delete them, whenever you like.
- **Changes appear on the website within about five minutes**, usually right away.
- **Drawer of the Day:** give a find a date to show it on that exact day. Finds with no date take
  turns, one per day.

## Before the Sheet is connected

- `admin.html` opens in **practice mode**. Try everything with sample items; changes are saved
  only in that browser. See them on the site by adding `?practice` to the address.
- Add `?demo` to the website address to see every feature filled with sample content.
- The live site reads `data/site-data.json`, and Lost Board cards are sent to the shoppe by email.
