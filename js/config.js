/* Site settings — the only file the shoppe needs to touch to go live with the Google Sheet. */
window.SHOPPE_CONFIG = {
  // Paste the Google Apps Script web-app URL here once the Sheet is set up
  // (see google-sheets/SETUP.md). While this is empty, the site reads data/site-data.json
  // and Lost Board cards are sent to the shoppe by email instead.
  sheetApi: "",

  dataFile: "data/site-data.json",
  // Preview every feature filled with sample content by adding ?demo to the address
  demoFile: "data/demo-data.json",

  shopEmail: "Lostandfoundthriftshoppe@gmail.com",
  timeZone: "America/New_York"
};
